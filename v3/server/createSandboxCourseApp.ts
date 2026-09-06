import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  createCourseRequestSchema,
  createLessonRequestSchema,
  lessonResponseSchema,
  teacherCourseSchema,
  teacherCoursesResponseSchema,
  teacherLessonsResponseSchema,
  updateCourseRequestSchema,
} from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import {
  createSandboxCourse,
  deleteSandboxCourse,
  initializeSandboxCourseSchema,
  listSandboxCourses,
  updateSandboxCourse,
} from './modules/courses/sandboxCourseRepository.js';
import {
  createSandboxLesson,
  initializeSandboxLessonSchema,
  listEffectiveLessonSummaries,
} from './modules/lessons/sandboxLessonRepository.js';
import { initializeSandboxLessonDraftSchema } from './modules/teacher/sandboxLessonDraftRepository.js';

export type SandboxCourseAppDependencies = {
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

const courseIdOf = (request: Request): number | null => {
  const id = Number(request.params.courseId);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const createSandboxCourseApp = (dependencies: SandboxCourseAppDependencies): Express => {
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  const courseSchemaReady = dependencies.schemaReady ?? initializeSandboxCourseSchema(dependencies.writeDatabase);
  const lessonSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonSchema(dependencies.writeDatabase);
  const draftSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonDraftSchema(dependencies.writeDatabase);
  // Do not derive another rejecting Promise from the shared production gate:
  // on a cold start it may reject before this module receives a request.
  const schemaReady = dependencies.schemaReady
    ?? Promise.all([courseSchemaReady, lessonSchemaReady, draftSchemaReady]).then(() => undefined);

  const teacherContext = async (response: Response) => {
    const repositories = createLegacyReadRepositories(dependencies.readDatabase);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    return user && user.role === 'teacher' && !user.isBlocked ? { user, repositories } : null;
  };

  app.get('/api/v2/sandbox/teacher/courses', auth, async (_request, response, next) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const courses = await listSandboxCourses(dependencies.writeDatabase, await context.repositories.listCourses());
      const items = await Promise.all(courses.map(async (course) => ({
        ...courseView(course),
        lessonCount: (await listEffectiveLessonSummaries(dependencies.writeDatabase, course.id,
          await context.repositories.listLessonSummaries(course.id))).length,
      })));
      response.json(teacherCoursesResponseSchema.parse({ items }));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v2/sandbox/teacher/courses/:courseId/lessons', auth, async (request, response, next) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const courseId = courseIdOf(request);
      if (courseId === null) return errorBody('VALIDATION_FAILED', 'Некоректний courseId', 400, response);
      const courses = await listSandboxCourses(dependencies.writeDatabase, await context.repositories.listCourses());
      if (!courses.some((course) => course.id === courseId)) return errorBody('NOT_FOUND', 'Курс не знайдено', 404, response);
      const lessons = await listEffectiveLessonSummaries(dependencies.writeDatabase, courseId,
        await context.repositories.listLessonSummaries(courseId));
      response.json(teacherLessonsResponseSchema.parse({
        courseId,
        items: lessons.map((lesson) => ({
          lessonId: lesson.id, title: lesson.title, order: lesson.order,
          blockCount: lesson.blockCount, hasHomework: lesson.hasHomework,
        })),
      }));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/teacher/courses/:courseId/lessons', auth, async (request, response, next) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const courseId = courseIdOf(request);
      const input = createLessonRequestSchema.safeParse(request.body);
      if (courseId === null || !input.success) return errorBody('VALIDATION_FAILED', 'Некоректні дані уроку', 400, response);
      const courses = await listSandboxCourses(dependencies.writeDatabase, await context.repositories.listCourses());
      if (!courses.some((course) => course.id === courseId)) return errorBody('NOT_FOUND', 'Курс не знайдено', 404, response);
      const lesson = await createSandboxLesson(dependencies.writeDatabase, { courseId, ...input.data });
      response.status(201).json(lessonResponseSchema.parse({
        lessonId: lesson.id, title: lesson.title,
        contentRevision: lesson.contentRevision, blocks: lesson.blocks,
      }));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/teacher/courses', auth, async (request, response, next) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const input = createCourseRequestSchema.safeParse(request.body);
      if (!input.success) return errorBody('VALIDATION_FAILED', 'Некоректні дані курсу', 400, response);
      const course = await createSandboxCourse(dependencies.writeDatabase, input.data);
      response.status(201).json(teacherCourseSchema.parse(courseView(course)));
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/v2/sandbox/teacher/courses/:courseId', auth, async (request, response, next) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const courseId = courseIdOf(request);
      if (courseId === null) return errorBody('VALIDATION_FAILED', 'Некоректний courseId', 400, response);
      const input = updateCourseRequestSchema.safeParse(request.body);
      if (!input.success) return errorBody('VALIDATION_FAILED', 'Некоректні дані курсу', 400, response);
      const courses = await listSandboxCourses(dependencies.writeDatabase, await context.repositories.listCourses());
      const existing = courses.find((course) => course.id === courseId);
      if (!existing) return errorBody('NOT_FOUND', 'Курс не знайдено', 404, response);
      const updated = await updateSandboxCourse(dependencies.writeDatabase, { course: existing, ...input.data });
      response.json(teacherCourseSchema.parse(courseView(updated)));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/v2/sandbox/teacher/courses/:courseId', auth, async (request, response, next) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const courseId = courseIdOf(request);
      if (courseId === null) return errorBody('VALIDATION_FAILED', 'Некоректний courseId', 400, response);
      const courses = await listSandboxCourses(dependencies.writeDatabase, await context.repositories.listCourses());
      const existing = courses.find((course) => course.id === courseId);
      if (!existing) return errorBody('NOT_FOUND', 'Курс не знайдено', 404, response);
      await deleteSandboxCourse(dependencies.writeDatabase, existing);
      response.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox course API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    console.error(`[v3 sandbox course api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
