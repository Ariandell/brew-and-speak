import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  chatResponseSchema,
  photoMessagesResponseSchema,
  readChatRequestSchema,
  schedulePhotoRequestSchema,
  sendChatMessageRequestSchema,
  viewedPhotoRequestSchema,
} from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { sanitizeRichText } from './modules/lessons/normalizeBlock.js';
import {
  scheduleSandboxPhotoMessage,
  sendSandboxMessage,
  type SandboxMessage,
  type SandboxPhotoMessage,
} from './modules/communication/sandboxCommunicationRepository.js';
import {
  listEffectiveConversations,
  listEffectiveMessages,
  listEffectivePhotos,
  listEffectiveTeacherPhotos,
  deleteEffectivePhoto,
  markEffectiveMessageRead,
  markEffectivePhotoViewed,
} from './modules/communication/effectiveCommunication.js';
import { isSandboxUserBlocked } from './modules/teacher/sandboxStudentControlRepository.js';
import { initializeSandboxStudentControlSchema } from './modules/teacher/sandboxStudentControlRepository.js';

export type SandboxCommunicationAppDependencies = {
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

const iso = (value: string): string => new Date(value).toISOString();
const messageView = (message: SandboxMessage) => ({
  ...message,
  createdAt: iso(message.createdAt),
  readAt: message.readAt ? iso(message.readAt) : null,
});
const photoView = (photo: SandboxPhotoMessage) => ({
  ...photo,
  scheduledAt: iso(photo.scheduledAt),
  viewedAt: photo.viewedAt ? iso(photo.viewedAt) : null,
});

export const createSandboxCommunicationApp = (dependencies: SandboxCommunicationAppDependencies): Express => {
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '128kb' }));
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  const controlSchemaReady = dependencies.schemaReady ?? initializeSandboxStudentControlSchema(dependencies.writeDatabase);
  const context = async (response: Response) => {
    await controlSchemaReady;
    const repositories = createLegacyReadRepositories(dependencies.readDatabase);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (user?.role === 'student' && await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) {
      return { repositories, user: { ...user, isBlocked: true } };
    }
    return { repositories, user };
  };

  app.get('/api/v2/sandbox/me/chat', auth, async (_request, response, next) => {
    try {
      const { user } = await context(response);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      if (user.role !== 'student') return errorBody('FORBIDDEN', 'Student chat недоступний у teacher preview', 403, response);
      const items = await listEffectiveMessages(dependencies.readDatabase, dependencies.writeDatabase, {
        userId: user.id,
      });
      response.json(chatResponseSchema.parse({ items: items.map(messageView) }));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/me/chat/messages', auth, async (request, response, next) => {
    try {
      const parsed = sendChatMessageRequestSchema.safeParse(request.body);
      if (!parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректне повідомлення', 400, response);
      const { repositories, user } = await context(response);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      if (user.role !== 'student') return errorBody('FORBIDDEN', 'Лише student може писати у власний chat', 403, response);
      const teacher = await repositories.getTeacher();
      if (!teacher) return errorBody('NOT_FOUND', 'Викладача не знайдено', 404, response);
      const message = await sendSandboxMessage(dependencies.writeDatabase, {
        messageId: parsed.data.messageId,
        senderUserId: user.id,
        recipientUserId: teacher.id,
        body: sanitizeRichText(parsed.data.body),
        createdAt: new Date().toISOString(),
      });
      response.status(201).json(messageView(message));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/me/chat/read', auth, async (request, response, next) => {
    try {
      const parsed = readChatRequestSchema.safeParse(request.body);
      if (!parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректний read запит', 400, response);
      const { user } = await context(response);
      if (!user || user.isBlocked) return errorBody(user ? 'BLOCKED' : 'NOT_FOUND', 'Недоступний chat', user ? 403 : 404, response);
      const marked = await markEffectiveMessageRead(dependencies.writeDatabase, {
        messageId: parsed.data.messageId, userId: user.id, readAt: new Date().toISOString(),
      });
      if (!marked) return errorBody('NOT_FOUND', 'Повідомлення не знайдено або воно не адресоване користувачу', 404, response);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  app.get('/api/v2/sandbox/teacher/chat/conversations', auth, async (_request, response, next) => {
    try {
      const { repositories, user } = await context(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const students = await repositories.listStudents();
      response.json({ items: await listEffectiveConversations(
        dependencies.readDatabase, dependencies.writeDatabase, user.id, students.map((student) => student.id),
      ) });
    } catch (error) { next(error); }
  });

  app.get('/api/v2/sandbox/teacher/chat/conversations/:studentId', auth, async (request, response, next) => {
    try {
      const studentId = typeof request.params.studentId === 'string' ? Number(request.params.studentId) : NaN;
      if (!Number.isInteger(studentId) || studentId <= 0) return errorBody('VALIDATION_FAILED', 'Некоректний studentId', 400, response);
      const { repositories, user } = await context(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const student = await repositories.getUserById(studentId);
      if (!student || student.role !== 'student') return errorBody('NOT_FOUND', 'Учня не знайдено', 404, response);
      const items = await listEffectiveMessages(dependencies.readDatabase, dependencies.writeDatabase, {
        userId: user.id, otherUserId: student.id,
      });
      response.json(chatResponseSchema.parse({ items: items.map(messageView) }));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/teacher/chat/conversations/:studentId/messages', auth, async (request, response, next) => {
    try {
      const studentId = typeof request.params.studentId === 'string' ? Number(request.params.studentId) : NaN;
      const parsed = sendChatMessageRequestSchema.safeParse(request.body);
      if (!Number.isInteger(studentId) || studentId <= 0 || !parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректне teacher повідомлення', 400, response);
      const { repositories, user } = await context(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const student = await repositories.getUserById(studentId);
      if (!student || student.role !== 'student') return errorBody('NOT_FOUND', 'Учня не знайдено', 404, response);
      const message = await sendSandboxMessage(dependencies.writeDatabase, {
        messageId: parsed.data.messageId, senderUserId: user.id, recipientUserId: student.id,
        body: sanitizeRichText(parsed.data.body), createdAt: new Date().toISOString(),
      });
      response.status(201).json(messageView(message));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/teacher/chat/read', auth, async (request, response, next) => {
    try {
      const parsed = readChatRequestSchema.safeParse(request.body);
      if (!parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректний read запит', 400, response);
      const { user } = await context(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const marked = await markEffectiveMessageRead(dependencies.writeDatabase, {
        messageId: parsed.data.messageId, userId: user.id, readAt: new Date().toISOString(),
      });
      if (!marked) return errorBody('NOT_FOUND', 'Повідомлення не знайдено або воно не адресоване викладачу', 404, response);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  app.get('/api/v2/sandbox/me/photo-messages', auth, async (_request, response, next) => {
    try {
      const { user } = await context(response);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      const items = await listEffectivePhotos(dependencies.readDatabase, dependencies.writeDatabase, {
        userId: user.id, now: new Date().toISOString(),
      });
      response.json(photoMessagesResponseSchema.parse({ items: items.map(photoView) }));
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/me/photo-messages/:messageId/viewed', auth, async (request, response, next) => {
    try {
      const parsed = viewedPhotoRequestSchema.safeParse(request.body ?? {});
      const messageId = typeof request.params.messageId === 'string' ? request.params.messageId : '';
      if (!messageId || !parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректний photo viewed запит', 400, response);
      const { user } = await context(response);
      if (!user || user.isBlocked) return errorBody(user ? 'BLOCKED' : 'NOT_FOUND', 'Недоступні photo messages', user ? 403 : 404, response);
      const marked = await markEffectivePhotoViewed(dependencies.writeDatabase, {
        photoId: messageId, userId: user.id, viewedAt: new Date().toISOString(),
      });
      if (!marked) return errorBody('NOT_FOUND', 'Photo message не знайдено або ще не опубліковано', 404, response);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  app.post('/api/v2/sandbox/teacher/photo-messages', auth, async (request, response, next) => {
    try {
      const parsed = schedulePhotoRequestSchema.safeParse(request.body);
      if (!parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректна photo-розсилка', 400, response);
      const { user } = await context(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      await scheduleSandboxPhotoMessage(dependencies.writeDatabase, { ...parsed.data, createdAt: new Date().toISOString() });
      response.status(201).json({ photoId: parsed.data.photoId });
    } catch (error) { next(error); }
  });

  app.get('/api/v2/sandbox/teacher/photo-messages', auth, async (_request, response, next) => {
    try {
      const { user } = await context(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      response.json(photoMessagesResponseSchema.parse({ items: await listEffectiveTeacherPhotos(dependencies.readDatabase, dependencies.writeDatabase) }));
    } catch (error) { next(error); }
  });

  app.delete('/api/v2/sandbox/teacher/photo-messages/:messageId', auth, async (request, response, next) => {
    try {
      const messageId = typeof request.params.messageId === 'string' ? request.params.messageId : '';
      const { user } = await context(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      if (!messageId || !(await deleteEffectivePhoto(dependencies.writeDatabase, messageId))) return errorBody('NOT_FOUND', 'Photo message не знайдено', 404, response);
      response.status(204).end();
    } catch (error) { next(error); }
  });

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox communication API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    console.error(`[v3 sandbox communication api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
