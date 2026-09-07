import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { dictionaryResponseSchema, flashcardSchema, srsReviewRequestSchema, srsReviewResponseSchema, studySessionResponseSchema } from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { initializeSandboxSrsSchema, reviewSandboxFlashcard, SrsIdempotencyConflictError } from './modules/flashcards/sandboxSrsRepository.js';
import { isSandboxUserBlocked } from './modules/teacher/sandboxStudentControlRepository.js';
import { initializeSandboxStudentControlSchema } from './modules/teacher/sandboxStudentControlRepository.js';
import { getSandboxEnrollment, initializeSandboxEnrollmentSchema } from './modules/courses/sandboxEnrollmentRepository.js';
import { listEffectiveFlashcards } from './modules/flashcards/effectiveFlashcards.js';
import { initializeSandboxAttemptSchema } from './modules/progress/sandboxAttemptRepository.js';
import { initializeSandboxLessonSchema } from './modules/lessons/sandboxLessonRepository.js';
import { initializeSandboxLessonDraftSchema } from './modules/teacher/sandboxLessonDraftRepository.js';
import { initializeSandboxHomeworkSchema } from './modules/homework/sandboxHomeworkRepository.js';

export type SandboxSrsAppDependencies = {
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

export const createSandboxSrsApp = (dependencies: SandboxSrsAppDependencies): Express => {
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  const controlSchemaReady = dependencies.schemaReady ?? initializeSandboxStudentControlSchema(dependencies.writeDatabase);
  const enrollmentSchemaReady = dependencies.schemaReady ?? initializeSandboxEnrollmentSchema(dependencies.writeDatabase);
  const srsSchemaReady = dependencies.schemaReady ?? initializeSandboxSrsSchema(dependencies.writeDatabase);
  const attemptSchemaReady = dependencies.schemaReady ?? initializeSandboxAttemptSchema(dependencies.writeDatabase);
  const lessonSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonSchema(dependencies.writeDatabase);
  const draftSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonDraftSchema(dependencies.writeDatabase);
  const homeworkSchemaReady = dependencies.schemaReady ?? initializeSandboxHomeworkSchema(dependencies.writeDatabase);

  const context = async (response: Response) => {
    await Promise.all([controlSchemaReady, enrollmentSchemaReady, srsSchemaReady, attemptSchemaReady,
      lessonSchemaReady, draftSchemaReady, homeworkSchemaReady]);
    const repositories = createLegacyReadRepositories(dependencies.readDatabase);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user) return null;
    if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id) || user.role !== 'student') return null;
    const courseId = await getSandboxEnrollment(dependencies.writeDatabase, user.id) ?? user.enrolledCourseId;
    return courseId === null ? null : { user, courseId };
  };

  app.get('/api/v2/sandbox/me/dictionary', auth, async (_request, response, next) => {
    try {
      const current = await context(response);
      if (!current) return errorBody('FORBIDDEN', 'Словник недоступний', 403, response);
      const items = await listEffectiveFlashcards(dependencies.readDatabase, dependencies.writeDatabase,
        current.user, current.courseId);
      response.json(dictionaryResponseSchema.parse({ items: items.map(card => flashcardSchema.parse({
        flashcardId: card.id, lessonId: card.lessonId, lessonTitle: card.lessonTitle, front: card.front,
        back: card.back, examplePhrase: card.examplePhrase, timesShown: card.timesShown,
        timesCorrect: card.timesCorrect, timesWrong: card.timesWrong, easeFactor: card.easeFactor,
        intervalDays: card.intervalDays, nextReviewAt: card.nextReviewAt,
      })) }));
    } catch (error) { next(error); }
  });

  app.get('/api/v2/sandbox/me/study-session', auth, async (request, response, next) => {
    try {
      const current = await context(response);
      if (!current) return errorBody('FORBIDDEN', 'Повторення недоступне', 403, response);
      const rawLimit = request.query.limit === undefined ? 20 : Number(request.query.limit);
      if (!Number.isInteger(rawLimit) || rawLimit < 1 || rawLimit > 20) return errorBody('VALIDATION_FAILED', 'Некоректний limit', 400, response);
      const items = await listEffectiveFlashcards(dependencies.readDatabase, dependencies.writeDatabase,
        current.user, current.courseId, rawLimit);
      response.json(studySessionResponseSchema.parse({ items: items.map(card => ({
        flashcardId: card.id, lessonId: card.lessonId, lessonTitle: card.lessonTitle, front: card.front,
        back: card.back, examplePhrase: card.examplePhrase, timesShown: card.timesShown,
        timesCorrect: card.timesCorrect, timesWrong: card.timesWrong, easeFactor: card.easeFactor,
        intervalDays: card.intervalDays, nextReviewAt: card.nextReviewAt,
      })) }));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/me/flashcards/:flashcardId/review', auth, async (request, response, next) => {
    try {
      await controlSchemaReady;
      const flashcardId = typeof request.params.flashcardId === 'string' ? Number(request.params.flashcardId) : NaN;
      const parsed = srsReviewRequestSchema.safeParse(request.body);
      if (!Number.isInteger(flashcardId) || flashcardId <= 0 || !parsed.success) {
        return errorBody('VALIDATION_FAILED', 'Некоректний flashcard review', 400, response);
      }
      const current = await context(response);
      if (!current) return errorBody('FORBIDDEN', 'SRS доступний лише учню', 403, response);
      const { user } = current;
      const available = await listEffectiveFlashcards(dependencies.readDatabase, dependencies.writeDatabase, user, current.courseId);
      const card = available.find(card => card.id === flashcardId);
      if (!card) return errorBody('NOT_FOUND', 'Flashcard недоступний', 404, response);
      const result = await reviewSandboxFlashcard(dependencies.writeDatabase, {
        userId: user.id,
        flashcardId,
        correct: parsed.data.correct,
        idempotencyKey: parsed.data.idempotencyKey,
        now: new Date(),
        initialState: { ...card, nextReviewAt: card.nextReviewAt ? new Date(card.nextReviewAt) : null },
      });
      response.status(201).json(srsReviewResponseSchema.parse(result));
    } catch (error) {
      if (error instanceof SrsIdempotencyConflictError) {
        errorBody('CONFLICT', 'Idempotency key вже використано для іншої картки', 409, response);
        return;
      }
      next(error);
    }
  });

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox SRS API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    console.error(`[v3 sandbox srs api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
