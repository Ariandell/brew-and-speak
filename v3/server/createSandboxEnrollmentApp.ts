import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  courseListResponseSchema,
  coursePathResponseSchema,
  enrollmentRequestSchema,
  enrollmentResponseSchema,
  meCourseResponseSchema,
} from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import { createLegacyReadRepositories, type LegacyUser } from './modules/legacy/repositories.js';
import { deriveCoursePath } from './modules/progress/coursePath.js';
import {
  chooseSandboxEnrollment,
  getSandboxEnrollment,
  initializeSandboxEnrollmentSchema,
} from './modules/courses/sandboxEnrollmentRepository.js';
import { isSandboxUserBlocked } from './modules/teacher/sandboxStudentControlRepository.js';
import { initializeSandboxStudentControlSchema } from './modules/teacher/sandboxStudentControlRepository.js';
import { initializeSandboxCourseSchema, listSandboxCourses } from './modules/courses/sandboxCourseRepository.js';
import { effectiveCoursePathRecords } from './modules/progress/effectiveCoursePath.js';
import { initializeSandboxAttemptSchema } from './modules/progress/sandboxAttemptRepository.js';
import { initializeSandboxLessonSchema } from './modules/lessons/sandboxLessonRepository.js';
import { initializeSandboxLessonDraftSchema } from './modules/teacher/sandboxLessonDraftRepository.js';
import { initializeSandboxHomeworkSchema } from './modules/homework/sandboxHomeworkRepository.js';

export type SandboxEnrollmentAppDependencies = {
  readDatabase: ReadOnlyDatabase;
  writeDatabase: SandboxWriteDatabase;
  writeDatabaseUrl: string;
  botToken: string;
  runtime?: 'sandbox' | 'production';
  schemaReady?: Promise<void>;
};

const errorBody = (code: string, message: string, status: number, response: Response) => {
  response.status(status).json({ code, message, requestId: randomUUID() });
};

const courseView = (course: Awaited<ReturnType<ReturnType<typeof createLegacyReadRepositories>['listCourses']>>[number]) => ({
  courseId: course.id,
  title: course.title,
  description: course.description,
  order: course.order,
  lessonCount: course.lessonCount,
});

export const createSandboxEnrollmentApp = (dependencies: SandboxEnrollmentAppDependencies): Express => {
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  const schemaReady = dependencies.schemaReady ?? initializeSandboxEnrollmentSchema(dependencies.writeDatabase);
  const controlSchemaReady = dependencies.schemaReady ?? initializeSandboxStudentControlSchema(dependencies.writeDatabase);
  const courseSchemaReady = dependencies.schemaReady ?? initializeSandboxCourseSchema(dependencies.writeDatabase);
  const attemptSchemaReady = dependencies.schemaReady ?? initializeSandboxAttemptSchema(dependencies.writeDatabase);
  const lessonSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonSchema(dependencies.writeDatabase);
  const draftSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonDraftSchema(dependencies.writeDatabase);
  const homeworkSchemaReady = dependencies.schemaReady ?? initializeSandboxHomeworkSchema(dependencies.writeDatabase);

  const studentContext = async (response: Response): Promise<{ user: LegacyUser; repositories: ReturnType<typeof createLegacyReadRepositories> } | null> => {
    await Promise.all([controlSchemaReady, courseSchemaReady, attemptSchemaReady,
      lessonSchemaReady, draftSchemaReady, homeworkSchemaReady]);
    const repositories = createLegacyReadRepositories(dependencies.readDatabase);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user || user.role !== 'student' || user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return null;
    return { user, repositories };
  };

  app.get('/api/v2/sandbox/courses', auth, async (_request, response, next) => {
    try {
      await schemaReady;
      await controlSchemaReady;
      const context = await studentContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав для вибору курсу', 403, response);
      const courses = await listSandboxCourses(dependencies.writeDatabase, await context.repositories.listCourses());
      response.json(courseListResponseSchema.parse({ items: courses.map(courseView) }));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v2/sandbox/me/course', auth, async (_request, response, next) => {
    try {
      await schemaReady;
      await controlSchemaReady;
      const context = await studentContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав для перегляду курсу', 403, response);
      const selectedCourseId = await getSandboxEnrollment(dependencies.writeDatabase, context.user.id)
        ?? context.user.enrolledCourseId;
      if (selectedCourseId === null) return errorBody('NOT_FOUND', 'Курс не обрано', 404, response);
      const course = (await listSandboxCourses(dependencies.writeDatabase, await context.repositories.listCourses()))
        .find(item => item.id === selectedCourseId);
      if (!course) return errorBody('NOT_FOUND', 'Курс не знайдено', 404, response);
      const effectiveUser = { ...context.user, enrolledCourseId: selectedCourseId };
      const path = deriveCoursePath(effectiveUser, await effectiveCoursePathRecords(dependencies.writeDatabase,
        context.user.id, await context.repositories.getCoursePath(selectedCourseId, context.user.id),
        { courseId: selectedCourseId }));
      response.json(meCourseResponseSchema.parse({
        course: courseView(course),
        completedLessons: path.items.filter((item) => item.status === 'completed').length,
        totalLessons: path.items.length,
        nextLessonId: path.items.find((item) => item.status === 'available')?.lessonId ?? null,
      }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v2/sandbox/me/enrollment', auth, async (request, response, next) => {
    try {
      await schemaReady;
      await controlSchemaReady;
      const context = await studentContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав для вибору курсу', 403, response);
      const input = enrollmentRequestSchema.safeParse(request.body);
      if (!input.success) return errorBody('VALIDATION_FAILED', 'Некоректний courseId', 400, response);
      const course = (await listSandboxCourses(dependencies.writeDatabase, await context.repositories.listCourses()))
        .find(item => item.id === input.data.courseId);
      if (!course) return errorBody('NOT_FOUND', 'Курс не знайдено', 404, response);
      const courseId = await chooseSandboxEnrollment(dependencies.writeDatabase, {
        userId: context.user.id,
        courseId: course.id,
        enrolledAt: new Date().toISOString(),
      });
      response.status(200).json(enrollmentResponseSchema.parse({ courseId }));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v2/sandbox/me/course/path', auth, async (_request, response, next) => {
    try {
      await schemaReady;
      await controlSchemaReady;
      const context = await studentContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав для курсу', 403, response);
      const selectedCourseId = await getSandboxEnrollment(dependencies.writeDatabase, context.user.id)
        ?? context.user.enrolledCourseId;
      if (selectedCourseId === null) return errorBody('NOT_FOUND', 'Курс не обрано', 404, response);
      const effectiveUser = { ...context.user, enrolledCourseId: selectedCourseId };
      const records = await effectiveCoursePathRecords(dependencies.writeDatabase, context.user.id,
        await context.repositories.getCoursePath(selectedCourseId, context.user.id),
        { courseId: selectedCourseId });
      response.json(coursePathResponseSchema.parse(deriveCoursePath(effectiveUser, records)));
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox enrollment API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    console.error(`[v3 sandbox enrollment api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
