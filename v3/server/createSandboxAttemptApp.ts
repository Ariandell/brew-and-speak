import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { evaluateAnswer } from './modules/progress/evaluateAnswer.js';
import { effectiveCoursePathRecords } from './modules/progress/effectiveCoursePath.js';
import { initializeSandboxLessonDraftSchema } from './modules/teacher/sandboxLessonDraftRepository.js';
import { getEffectiveLesson, initializeSandboxLessonSchema } from './modules/lessons/sandboxLessonRepository.js';
import {
  attemptSnapshotSchema,
  lessonResponseSchema,
  recordAttemptAnswerRequestSchema,
  startAttemptRequestSchema,
} from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { deriveCoursePath } from './modules/progress/coursePath.js';
import { decideRetake } from './modules/progress/retakePolicy.js';
import {
  finishSandboxAttempt,
  getAttemptBlock,
  recordSandboxAttemptAnswer,
  startSandboxAttempt,
} from './modules/progress/sandboxAttemptRepository.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { isSandboxUserBlocked } from './modules/teacher/sandboxStudentControlRepository.js';
import { initializeSandboxStudentControlSchema } from './modules/teacher/sandboxStudentControlRepository.js';
import { getSandboxEnrollment, initializeSandboxEnrollmentSchema } from './modules/courses/sandboxEnrollmentRepository.js';
import { initializeSandboxHomeworkSchema } from './modules/homework/sandboxHomeworkRepository.js';

export type SandboxAttemptAppDependencies = {
  readDatabase: ReadOnlyDatabase;
  writeDatabase: SandboxWriteDatabase;
  writeDatabaseUrl: string;
  botToken: string;
  runtime?: 'sandbox' | 'production';
  schemaReady?: Promise<void>;
};

const scoredTypes = new Set(['quiz', 'fill_blank', 'true_false', 'match_pairs', 'word_order']);

const errorBody = (code: string, message: string, status: number, response: Response, retryAfter?: number) => {
  response.status(status).json({
    code,
    message,
    requestId: randomUUID(),
    ...(retryAfter === undefined ? {} : { retryAfter }),
  });
};

const parseBody = <T>(schema: { parse(value: unknown): T }, request: Request, response: Response): T | null => {
  try {
    return schema.parse(request.body);
  } catch {
    errorBody('VALIDATION_FAILED', 'Некоректне тіло запиту', 400, response);
    return null;
  }
};

const serverNow = (): string => new Date().toISOString();

export const createSandboxAttemptApp = (dependencies: SandboxAttemptAppDependencies): Express => {
  // Guard at construction time as well as in the writer factory: this app is
  // intentionally impossible to configure against a remote/production DB.
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  const enrollmentSchemaReady = dependencies.schemaReady ?? initializeSandboxEnrollmentSchema(dependencies.writeDatabase);
  const controlSchemaReady = dependencies.schemaReady ?? initializeSandboxStudentControlSchema(dependencies.writeDatabase);
  const draftSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonDraftSchema(dependencies.writeDatabase);
  const lessonSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonSchema(dependencies.writeDatabase);
  const homeworkSchemaReady = dependencies.schemaReady ?? initializeSandboxHomeworkSchema(dependencies.writeDatabase);

  app.get('/api/v2/sandbox/lessons/:lessonId', auth, async (request, response, next) => {
    try {
      await Promise.all([enrollmentSchemaReady, controlSchemaReady, draftSchemaReady, lessonSchemaReady, homeworkSchemaReady]);
      const lessonId = Number(request.params.lessonId);
      if (!Number.isInteger(lessonId) || lessonId <= 0) return errorBody('VALIDATION_FAILED', 'Некоректний lessonId', 400, response);
      const repositories = createLegacyReadRepositories(dependencies.readDatabase);
      const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      if (user.role !== 'student') return errorBody('FORBIDDEN', 'Урок учня недоступний у режимі викладача', 403, response);
      const selectedCourseId = await getSandboxEnrollment(dependencies.writeDatabase, user.id) ?? user.enrolledCourseId;
      const lesson = await getEffectiveLesson(dependencies.writeDatabase, lessonId, await repositories.getLesson(lessonId));
      if (selectedCourseId === null || !lesson || lesson.courseId !== selectedCourseId) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      const records = await effectiveCoursePathRecords(dependencies.writeDatabase, user.id,
        await repositories.getCoursePath(selectedCourseId, user.id), { courseId: selectedCourseId });
      const path = deriveCoursePath({ ...user, enrolledCourseId: selectedCourseId }, records);
      const lessonState = path.items.find(item => item.lessonId === lesson.id);
      if (!lessonState || lessonState.status === 'locked') return errorBody('FORBIDDEN', 'Урок ще недоступний', 403, response);
      response.json(lessonResponseSchema.parse({
        lessonId: lesson.id,
        title: lesson.title,
        contentRevision: lesson.contentRevision,
        blocks: lesson.blocks,
      }));
    } catch (error) { next(error); }
  });

  app.get('/api/v2/sandbox/me/course/path', auth, async (_request, response, next) => {
    try {
      await Promise.all([enrollmentSchemaReady, controlSchemaReady, draftSchemaReady, lessonSchemaReady, homeworkSchemaReady]);
      const repositories = createLegacyReadRepositories(dependencies.readDatabase);
      const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      const courseId = await getSandboxEnrollment(dependencies.writeDatabase, user.id) ?? user.enrolledCourseId;
      if (courseId === null) return errorBody('NOT_FOUND', 'Курс не обрано', 404, response);
      const records = await effectiveCoursePathRecords(dependencies.writeDatabase, user.id,
        await repositories.getCoursePath(courseId, user.id), { courseId });
      response.json(deriveCoursePath({ ...user, enrolledCourseId: courseId }, records));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/attempts', auth, async (request, response, next) => {
    try {
      await Promise.all([enrollmentSchemaReady, controlSchemaReady, draftSchemaReady, lessonSchemaReady, homeworkSchemaReady]);
      const input = parseBody(startAttemptRequestSchema, request, response);
      if (!input) return;
      const repositories = createLegacyReadRepositories(dependencies.readDatabase);
      const identity = response.locals.telegram;
      const user = await repositories.getUserByTelegramId(identity.telegramId);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      if (user.role !== 'student') return errorBody('FORBIDDEN', 'Sandbox attempt доступний лише учню', 403, response);
      const selectedCourseId = await getSandboxEnrollment(dependencies.writeDatabase, user.id) ?? user.enrolledCourseId;
      if (selectedCourseId === null) return errorBody('NOT_FOUND', 'Курс не обрано', 404, response);

      const lesson = await getEffectiveLesson(dependencies.writeDatabase, input.lessonId,
        await repositories.getLesson(input.lessonId));
      if (!lesson || lesson.courseId !== selectedCourseId) {
        return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      }
      const records = await effectiveCoursePathRecords(dependencies.writeDatabase, user.id,
        await repositories.getCoursePath(lesson.courseId, user.id), { courseId: lesson.courseId });
      const path = deriveCoursePath({ ...user, enrolledCourseId: selectedCourseId }, records);
      const lessonState = path.items.find((item) => item.lessonId === lesson.id);
      if (!lessonState) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      if (lessonState.status === 'locked') return errorBody('FORBIDDEN', 'Урок ще недоступний', 403, response);
      if (lessonState.status === 'completed') {
        const retake = decideRetake(lessonState.completedAt, new Date(), false);
        if (!retake.allowed) {
          const retryAfter = retake.retryAt ? Math.max(0, Math.ceil((retake.retryAt.getTime() - Date.now()) / 1000)) : undefined;
          return errorBody('COOLDOWN', 'Повторне проходження ще недоступне', 409, response, retryAfter);
        }
      }

      const blocks = lesson.blocks;
      const scoredBlockIds = blocks
        .filter((block) => scoredTypes.has(block.type))
        .map((block) => String(block.id));
      const attempt = await startSandboxAttempt(dependencies.writeDatabase, {
        attemptId: input.attemptId,
        userId: user.id,
        lessonId: lesson.id,
        contentRevision: lesson.contentRevision,
        scoredBlockIds,
        blocks,
        startedAt: serverNow(),
      });
      response.status(201).json(attemptSnapshotSchema.parse(attempt));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v2/sandbox/attempts/:attemptId/answers', auth, async (request, response, next) => {
    try {
      await controlSchemaReady;
      const input = parseBody(recordAttemptAnswerRequestSchema, request, response);
      if (!input) return;
      const attemptId = typeof request.params.attemptId === 'string' ? request.params.attemptId : '';
      if (!attemptId || attemptId.length > 80) return errorBody('VALIDATION_FAILED', 'Некоректний attemptId', 400, response);
      const repositories = createLegacyReadRepositories(dependencies.readDatabase);
      const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      if (user.role !== 'student') return errorBody('FORBIDDEN', 'Sandbox attempt доступний лише учню', 403, response);
      const block = await getAttemptBlock(dependencies.writeDatabase, attemptId, user.id, input.blockId);
      if (!block) return errorBody('NOT_FOUND', 'Блок спроби не знайдено', 404, response);
      const outcome = evaluateAnswer(block, input.answer);
      const result = await recordSandboxAttemptAnswer(dependencies.writeDatabase, {
        attemptId,
        userId: user.id,
        blockId: input.blockId,
        outcome,
        answeredAt: serverNow(),
      });
      if (result.reason === 'missing_attempt') return errorBody('NOT_FOUND', 'Спробу не знайдено', 404, response);
      if (result.reason === 'finished') return errorBody('CONFLICT', 'Спроба вже завершена', 409, response);
      if (result.reason === 'unknown_block') return errorBody('VALIDATION_FAILED', 'Блок не належить цій спробі', 400, response);
      response.status(result.recorded ? 201 : 200).json({ ...result, outcome });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v2/sandbox/attempts/:attemptId/finish', auth, async (request, response, next) => {
    try {
      await controlSchemaReady;
      const attemptId = typeof request.params.attemptId === 'string' ? request.params.attemptId : '';
      if (!attemptId || attemptId.length > 80) return errorBody('VALIDATION_FAILED', 'Некоректний attemptId', 400, response);
      const repositories = createLegacyReadRepositories(dependencies.readDatabase);
      const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      if (user.role !== 'student') return errorBody('FORBIDDEN', 'Sandbox attempt доступний лише учню', 403, response);
      const attempt = await finishSandboxAttempt(dependencies.writeDatabase, {
        attemptId,
        userId: user.id,
        finishedAt: serverNow(),
      });
      response.json(attemptSnapshotSchema.parse(attempt));
    } catch (error) {
      if (error instanceof Error && error.message === 'Attempt does not exist') {
        errorBody('NOT_FOUND', 'Спробу не знайдено', 404, response);
        return;
      }
      next(error);
    }
  });

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    console.error(`[v3 sandbox api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
