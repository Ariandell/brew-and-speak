import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import { assetMetadataSchema, assetUploadChunkRequestSchema, assetUploadSessionRequestSchema,
  assetUploadSessionSchema, sandboxAssetUploadRequestSchema } from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { abortSandboxAssetUpload, cleanupExpiredAssetUploadSessions, createSandboxAssetUploadSession,
  finalizeSandboxAssetUpload, getOwnedAsset, initializeSandboxAssetSchema, SandboxAssetConflictError,
  SandboxAssetUploadError, uploadSandboxAsset, uploadSandboxAssetChunk } from './modules/media/sandboxAssetRepository.js';
import { initializeSandboxStudentControlSchema, isSandboxUserBlocked } from './modules/teacher/sandboxStudentControlRepository.js';
import { getSandboxEnrollment, initializeSandboxEnrollmentSchema } from './modules/courses/sandboxEnrollmentRepository.js';
import { initializeSandboxLessonSchema } from './modules/lessons/sandboxLessonRepository.js';
import { initializeSandboxCommunicationSchema } from './modules/communication/sandboxCommunicationRepository.js';
import { initializeSandboxLessonDraftSchema } from './modules/teacher/sandboxLessonDraftRepository.js';

export type SandboxMediaAppDependencies = {
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

export const createSandboxMediaApp = (dependencies: SandboxMediaAppDependencies): Express => {
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  app.use('/api/v2/sandbox', auth);
  // A 512 KiB raw chunk is ~683 KiB in base64. Keeping the parser below 1 MiB
  // ensures no upload request can approach the serverless platform body limit.
  app.use(express.json({ limit: '900kb' }));
  const schemaReady = dependencies.schemaReady ?? initializeSandboxAssetSchema(dependencies.writeDatabase);
  const controlReady = dependencies.schemaReady ?? initializeSandboxStudentControlSchema(dependencies.writeDatabase);
  const enrollmentReady = dependencies.schemaReady ?? initializeSandboxEnrollmentSchema(dependencies.writeDatabase);
  const lessonsReady = dependencies.schemaReady ?? initializeSandboxLessonSchema(dependencies.writeDatabase);
  const draftsReady = dependencies.schemaReady ?? initializeSandboxLessonDraftSchema(dependencies.writeDatabase);
  const communicationReady = dependencies.schemaReady ?? initializeSandboxCommunicationSchema(dependencies.writeDatabase);

  const requireUploader = async (response: Response) => {
    await Promise.all([schemaReady, controlReady]);
    const repositories = createLegacyReadRepositories(dependencies.readDatabase);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user || user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return null;
    return user;
  };

  const mapUploadError = (error: unknown, response: Response): boolean => {
    if (error instanceof SandboxAssetConflictError) {
      errorBody('CONFLICT', 'assetId уже використовується для іншого файлу', 409, response);
      return true;
    }
    if (error instanceof SandboxAssetUploadError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403
        : error.code === 'LIMIT' ? 413 : error.code === 'CHECKSUM' ? 400 : 409;
      const code = error.code === 'LIMIT' ? 'PAYLOAD_TOO_LARGE'
        : error.code === 'CHECKSUM' ? 'VALIDATION_FAILED'
        : error.code === 'SEQUENCE' ? 'CONFLICT'
        : error.code === 'EXPIRED' ? 'CONFLICT' : error.code;
      errorBody(code, error.message, status, response);
      return true;
    }
    if (error instanceof Error && /Asset exceeds|Unsupported asset|Invalid base64/.test(error.message)) {
      errorBody('VALIDATION_FAILED', error.message, 400, response);
      return true;
    }
    return false;
  };

  app.post('/api/v2/sandbox/assets/uploads', async (_request, response, next) => {
    try {
      const user = await requireUploader(response);
      if (!user) return errorBody('FORBIDDEN', 'Недостатньо прав для завантаження медіа', 403, response);
      const parsed = assetUploadSessionRequestSchema.strict().safeParse(_request.body);
      if (!parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректний план завантаження', 400, response);
      const now = new Date().toISOString();
      await cleanupExpiredAssetUploadSessions(dependencies.writeDatabase, now);
      const session = await createSandboxAssetUploadSession(dependencies.writeDatabase,
        { ...parsed.data, ownerUserId: user.id, createdAt: now });
      response.status(201).json(assetUploadSessionSchema.parse(session));
    } catch (error) { if (!mapUploadError(error, response)) next(error); }
  });

  app.put('/api/v2/sandbox/assets/uploads/:uploadId/chunks/:chunkIndex', async (request, response, next) => {
    try {
      const user = await requireUploader(response);
      if (!user) return errorBody('FORBIDDEN', 'Недостатньо прав для завантаження медіа', 403, response);
      const parsed = assetUploadChunkRequestSchema.strict().safeParse(request.body);
      const chunkIndexText = String(request.params.chunkIndex);
      const chunkIndex = Number(chunkIndexText);
      if (!parsed.success || !/^(0|[1-9]\d*)$/.test(chunkIndexText) || !Number.isSafeInteger(chunkIndex)) {
        return errorBody('VALIDATION_FAILED', 'Некоректний чанк', 400, response);
      }
      const session = await uploadSandboxAssetChunk(dependencies.writeDatabase, { uploadId: String(request.params.uploadId),
        ownerUserId: user.id, chunkIndex, ...parsed.data, now: new Date().toISOString() });
      response.json(assetUploadSessionSchema.parse(session));
    } catch (error) { if (!mapUploadError(error, response)) next(error); }
  });

  app.post('/api/v2/sandbox/assets/uploads/:uploadId/finalize', async (request, response, next) => {
    try {
      const user = await requireUploader(response);
      if (!user) return errorBody('FORBIDDEN', 'Недостатньо прав для завантаження медіа', 403, response);
      const metadata = await finalizeSandboxAssetUpload(dependencies.writeDatabase,
        { uploadId: String(request.params.uploadId), ownerUserId: user.id, now: new Date().toISOString() });
      response.status(201).json(assetMetadataSchema.parse(metadata));
    } catch (error) { if (!mapUploadError(error, response)) next(error); }
  });

  app.delete('/api/v2/sandbox/assets/uploads/:uploadId', async (request, response, next) => {
    try {
      const user = await requireUploader(response);
      if (!user) return errorBody('FORBIDDEN', 'Недостатньо прав для завантаження медіа', 403, response);
      await abortSandboxAssetUpload(dependencies.writeDatabase,
        { uploadId: String(request.params.uploadId), ownerUserId: user.id, now: new Date().toISOString() });
      response.status(204).end();
    } catch (error) { if (!mapUploadError(error, response)) next(error); }
  });

  app.post(['/api/v2/sandbox/teacher/assets', '/api/v2/sandbox/me/assets'], async (request, response, next) => {
    try {
      await Promise.all([schemaReady, controlReady]);
      const repositories = createLegacyReadRepositories(dependencies.readDatabase);
      const teacher = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
      if (!teacher || teacher.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, teacher.id)
        || (request.path.includes('/teacher/') && teacher.role !== 'teacher')) return errorBody('FORBIDDEN', 'Недостатньо прав для завантаження медіа', 403, response);
      const parsed = sandboxAssetUploadRequestSchema.safeParse(request.body);
      if (!parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректний медіафайл', 400, response);
      const metadata = await uploadSandboxAsset(dependencies.writeDatabase, { ...parsed.data, userId: teacher.id, createdAt: new Date().toISOString() });
      response.status(201).json(assetMetadataSchema.parse(metadata));
    } catch (error) { if (!mapUploadError(error, response)) next(error); }
  });

  app.get('/api/v2/sandbox/assets/:assetId', async (request, response, next) => {
    try {
      await Promise.all([schemaReady, controlReady, enrollmentReady, lessonsReady, draftsReady, communicationReady]);
      const repositories = createLegacyReadRepositories(dependencies.readDatabase);
      const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
      if (!user || user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('FORBIDDEN', 'Недостатньо прав', 403, response);
      const assetId = String(request.params.assetId);
      let allowed = user.role === 'teacher';
      if (!allowed) {
        const own = await getOwnedAsset(dependencies.writeDatabase, assetId, user.id, false);
        allowed = Boolean(own);
        if (!allowed) {
          const courseId = await getSandboxEnrollment(dependencies.writeDatabase, user.id) ?? user.enrolledCourseId;
          const references = await dependencies.writeDatabase.execute({
          sql: `SELECT 1 AS present FROM v3_photo_messages WHERE asset_id = ? AND datetime(scheduled_at) <= datetime(?)
            UNION ALL SELECT 1 FROM photo_messages WHERE (image_url = ? OR image_url LIKE ?) AND datetime(scheduled_at) <= datetime(?)
            UNION ALL SELECT 1 FROM homework_submissions WHERE user_id = ? AND (file_url = ? OR file_url LIKE ?)
            UNION ALL SELECT 1 FROM v3_lesson_drafts drafts
              LEFT JOIN lessons legacy ON legacy.id = drafts.lesson_id
              LEFT JOIN v3_lessons current ON current.id = drafts.lesson_id
              WHERE COALESCE(legacy.level_id, current.course_id) = ? AND json_valid(drafts.blocks_json)
                AND EXISTS (SELECT 1 FROM json_tree(drafts.blocks_json) node
                  WHERE node.key = 'assetId' AND node.value = ?) LIMIT 1`,
          args: [assetId, new Date().toISOString(), assetId, `%/api/assets/${assetId}`, new Date().toISOString(), user.id,
            assetId, `%/api/assets/${assetId}`, courseId ?? -1, assetId],
        });
          allowed = references.rows.length > 0
            || (courseId !== null && await repositories.isAssetReferencedByCourse(assetId, courseId));
        }
      }
      if (!allowed) return errorBody('NOT_FOUND', 'Файл не знайдено', 404, response);
      const asset = await getOwnedAsset(dependencies.writeDatabase, assetId, undefined);
      if (asset) {
        response.set({ 'Content-Type': asset.mimeType, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
          'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}` });
        return response.send(Buffer.from(asset.base64Data, 'base64'));
      }
      const legacy = await dependencies.readDatabase.execute({ sql: 'SELECT mime_type, data FROM app_assets WHERE id = ? LIMIT 1', args: [assetId] });
      const legacyAsset = legacy.rows[0] as unknown as Record<string, unknown> | undefined;
      if (!legacyAsset) return errorBody('NOT_FOUND', 'Файл не знайдено', 404, response);
      const fileNameResult = await dependencies.readDatabase.execute({ sql: 'SELECT file_name FROM homework_submissions WHERE file_url LIKE ? ORDER BY id DESC LIMIT 1', args: [`%/api/assets/${assetId}%`] });
      const fileName = String(fileNameResult.rows[0]?.file_name ?? 'attachment');
      response.set({ 'Content-Type': String(legacyAsset.mime_type), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(fileName)}` });
      return response.send(Buffer.from(String(legacyAsset.data), 'base64'));
    } catch (error) { next(error); }
  });

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox media API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    if (error instanceof SyntaxError && 'status' in error && error.status === 413) {
      return errorBody('PAYLOAD_TOO_LARGE', 'Upload request body is too large', 413, response);
    }
    console.error(`[v3 sandbox media api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
