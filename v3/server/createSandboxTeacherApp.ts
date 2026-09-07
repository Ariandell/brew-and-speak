import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { vocabularySchema } from '../src/api/vocabularyContracts.js';
import { loadLessonVocabulary, saveLessonVocabulary } from './modules/teacher/lessonVocabularyRepository.js';
import { LessonDraftValidationError } from './modules/lessons/validateDraft.js';
import { generateVocabulary } from './modules/teacher/generateVocabulary.js';
import {
  lessonResponseSchema,
  teacherStatisticsResponseSchema,
  updateLessonRequestSchema,
} from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { LessonDraftConflictError, initializeSandboxLessonDraftSchema, saveSandboxLessonDraft } from './modules/teacher/sandboxLessonDraftRepository.js';
import { getEffectiveTeacherStatistics } from './modules/teacher/effectiveStatistics.js';
import {
  deleteSandboxLesson,
  getEffectiveLesson,
  initializeSandboxLessonSchema,
  LessonDeleteConflictError,
  updateSandboxLesson,
} from './modules/lessons/sandboxLessonRepository.js';

export type SandboxTeacherAppDependencies = {
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

const lessonIdOf = (request: Request): number | null => {
  const value = typeof request.params.lessonId === 'string' ? Number(request.params.lessonId) : NaN;
  return Number.isInteger(value) && value > 0 ? value : null;
};

export const createSandboxTeacherApp = (dependencies: SandboxTeacherAppDependencies): Express => {
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  const lessonSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonSchema(dependencies.writeDatabase);
  const draftSchemaReady = dependencies.schemaReady ?? initializeSandboxLessonDraftSchema(dependencies.writeDatabase);

  const teacherContext = async (response: Response) => {
    await Promise.all([lessonSchemaReady, draftSchemaReady]);
    const repositories = createLegacyReadRepositories(dependencies.readDatabase);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user || user.role !== 'teacher') return null;
    if (user.isBlocked) return null;
    return { user, repositories };
  };

  app.get('/api/v2/sandbox/teacher/statistics', auth, async (_request, response, next) => {
    try {
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав для статистики', 403, response);
      const item = await getEffectiveTeacherStatistics(dependencies.readDatabase, dependencies.writeDatabase);
      response.json(teacherStatisticsResponseSchema.parse({ item }));
    } catch (error) {
      next(error);
    }
  });

  app.route('/api/v2/sandbox/teacher/lessons/:lessonId/vocabulary')
    .all(auth)
    .get(async (request, response, next) => {
      try {
        const context = await teacherContext(response);
        if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
        const id = lessonIdOf(request);
        if (!id || !await getEffectiveLesson(dependencies.writeDatabase, id, await context.repositories.getLesson(id))) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
        response.json(await loadLessonVocabulary(dependencies.readDatabase, dependencies.writeDatabase, id));
      } catch (error) { next(error); }
    })
    .put(async (request, response, next) => {
      try {
        const context = await teacherContext(response);
        if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
        const id = lessonIdOf(request);
        const parsed = vocabularySchema.safeParse(request.body);
        if (!id || !parsed.success || new Set(parsed.data.items.map(item => item.id)).size !== parsed.data.items.length) return errorBody('VALIDATION_FAILED', 'Перевірте слова та переклади', 400, response);
        if (!await getEffectiveLesson(dependencies.writeDatabase, id, await context.repositories.getLesson(id))) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
        const current = await loadLessonVocabulary(dependencies.readDatabase, dependencies.writeDatabase, id);
        const ids = new Set(current.items.map(item => item.id));
        // Newly authored cards use safe high IDs; legacy IDs may only be retained in their own lesson.
        if (parsed.data.items.some(item => !ids.has(item.id) && item.id < 1000000000000)) return errorBody('VALIDATION_FAILED', 'Некоректний ID нової картки', 400, response);
        if (!await saveLessonVocabulary(dependencies.writeDatabase, id, parsed.data)) return errorBody('CONFLICT', 'Словник вже змінено в іншій вкладці. Відкрийте урок знову.', 409, response);
        response.json({ ...parsed.data, revision: parsed.data.revision + 1 });
      } catch (error) { next(error); }
    });

  app.post('/api/v2/sandbox/teacher/lessons/:lessonId/vocabulary/generate', auth, async (request, response, next) => {
    try {
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const id = lessonIdOf(request);
      if (!id) return errorBody('VALIDATION_FAILED', 'Некоректний урок', 400, response);
      const lesson = await getEffectiveLesson(dependencies.writeDatabase, id, await context.repositories.getLesson(id));
      if (!lesson) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      try { response.json(await generateVocabulary(lesson)); }
      catch { return errorBody('INTERNAL', 'Не вдалося згенерувати слова. Додайте їх вручну, списком або спробуйте пізніше.', 503, response); }
    } catch (error) { next(error); }
  });

  app.get('/api/v2/sandbox/teacher/lessons/:lessonId', auth, async (request, response, next) => {
    try {
      const lessonId = lessonIdOf(request);
      if (lessonId === null) return errorBody('VALIDATION_FAILED', 'Некоректний lessonId', 400, response);
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const lesson = await getEffectiveLesson(dependencies.writeDatabase, lessonId,
        await context.repositories.getLesson(lessonId));
      if (!lesson) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      const body = {
        lessonId: lesson.id,
        title: lesson.title,
        contentRevision: lesson.contentRevision,
        blocks: lesson.blocks,
      };
      response.json(lessonResponseSchema.parse(body));
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/v2/sandbox/teacher/lessons/:lessonId/blocks', auth, async (request, response, next) => {
    try {
      const lessonId = lessonIdOf(request);
      if (lessonId === null) return errorBody('VALIDATION_FAILED', 'Некоректний lessonId', 400, response);
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
        return errorBody('VALIDATION_FAILED', 'Некоректне тіло draft', 400, response);
      }
      const expectedRevision = request.body.expectedRevision;
      if (expectedRevision !== null && (!Number.isInteger(expectedRevision) || expectedRevision < 0)) {
        return errorBody('VALIDATION_FAILED', 'Некоректна content revision', 400, response);
      }
      const lesson = await getEffectiveLesson(dependencies.writeDatabase, lessonId,
        await context.repositories.getLesson(lessonId));
      if (!lesson) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      const draft = await saveSandboxLessonDraft(dependencies.writeDatabase, {
        lessonId,
        expectedRevision,
        blocks: request.body.blocks,
        updatedBy: context.user.id,
        updatedAt: new Date().toISOString(),
      });
      response.json(lessonResponseSchema.parse({
        lessonId,
        title: lesson.title,
        contentRevision: `draft-${draft.contentRevision}`,
        blocks: draft.blocks,
      }));
    } catch (error) {
      if (error instanceof LessonDraftConflictError) {
        errorBody('CONFLICT', 'Урок вже змінено в іншій вкладці', 409, response);
        return;
      }
      next(error);
    }
  });

  app.patch('/api/v2/sandbox/teacher/lessons/:lessonId', auth, async (request, response, next) => {
    try {
      const lessonId = lessonIdOf(request);
      if (lessonId === null) return errorBody('VALIDATION_FAILED', 'Некоректний lessonId', 400, response);
      const input = updateLessonRequestSchema.safeParse(request.body);
      if (!input.success) return errorBody('VALIDATION_FAILED', 'Некоректні дані уроку', 400, response);
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const lesson = await getEffectiveLesson(dependencies.writeDatabase, lessonId,
        await context.repositories.getLesson(lessonId));
      if (!lesson) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      const updated = await updateSandboxLesson(dependencies.writeDatabase, lesson, input.data);
      response.json(lessonResponseSchema.parse({
        lessonId: updated.id, title: updated.title,
        contentRevision: updated.contentRevision, blocks: updated.blocks,
      }));
    } catch (error) { next(error); }
  });

  app.delete('/api/v2/sandbox/teacher/lessons/:lessonId', auth, async (request, response, next) => {
    try {
      const lessonId = lessonIdOf(request);
      if (lessonId === null) return errorBody('VALIDATION_FAILED', 'Некоректний lessonId', 400, response);
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const lesson = await getEffectiveLesson(dependencies.writeDatabase, lessonId,
        await context.repositories.getLesson(lessonId));
      if (!lesson) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      await deleteSandboxLesson(dependencies.writeDatabase, lesson);
      response.status(204).end();
    } catch (error) {
      if (error instanceof LessonDeleteConflictError) {
        return errorBody('CONFLICT', 'Урок має прогрес, домашні роботи або картки й не може бути видалений', 409, response);
      }
      next(error);
    }
  });

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox teacher API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    if (error instanceof LessonDraftValidationError) return errorBody('VALIDATION_FAILED', 'Перевірте блоки уроку: заповніть варіанти, правильні відповіді та приберіть дублікати.', 400, response);
    console.error(`[v3 sandbox teacher api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
