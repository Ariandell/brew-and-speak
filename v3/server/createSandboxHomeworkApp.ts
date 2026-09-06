import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  gradeHomeworkRequestSchema,
  homeworkListResponseSchema,
  homeworkPromptResponseSchema,
  homeworkSubmissionSchema,
  submitHomeworkRequestSchema,
} from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { sanitizeRichText } from './modules/lessons/normalizeBlock.js';
import {
  getSandboxHomework,
  HomeworkConflictError,
  gradeSandboxHomework,
  listSandboxHomework,
  submitSandboxHomework,
  initializeSandboxHomeworkSchema,
} from './modules/homework/sandboxHomeworkRepository.js';
import { isSandboxUserBlocked } from './modules/teacher/sandboxStudentControlRepository.js';
import { initializeSandboxStudentControlSchema } from './modules/teacher/sandboxStudentControlRepository.js';
import { getSandboxEnrollment, initializeSandboxEnrollmentSchema } from './modules/courses/sandboxEnrollmentRepository.js';
import { getOwnedAsset, initializeSandboxAssetSchema } from './modules/media/sandboxAssetRepository.js';
import { initializeSandboxLessonDraftSchema } from './modules/teacher/sandboxLessonDraftRepository.js';
import { getEffectiveLesson, initializeSandboxLessonSchema } from './modules/lessons/sandboxLessonRepository.js';
import type { LegacyHomeworkSubmission } from './modules/legacy/repositories.js';

export type SandboxHomeworkAppDependencies = {
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

const isoOrEpoch = (value: string | null | undefined): string => {
  const date = new Date(value ?? 0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const outputSubmission = (submission: Awaited<ReturnType<typeof getSandboxHomework>>) => submission && ({
  submissionId: submission.submissionId,
  userId: submission.userId,
  lessonId: submission.lessonId,
  answerHtml: submission.answerText,
  status: submission.status,
  grade: submission.grade,
  teacherComment: submission.teacherComment,
  createdAt: isoOrEpoch(submission.createdAt),
  gradedAt: submission.gradedAt ? isoOrEpoch(submission.gradedAt) : null,
  assets: submission.assets,
});

const legacyAssetId = (url: string | null): string | null => {
  if (!url) return null;
  const match = /^\/api\/assets\/([^/?#]+)/.exec(url);
  return match ? decodeURIComponent(match[1]) : null;
};

const outputLegacySubmission = (submission: LegacyHomeworkSubmission) => ({
  submissionId: String(submission.id), userId: submission.userId, lessonId: submission.lessonId,
  answerHtml: sanitizeRichText(submission.answerText), status: submission.status,
  grade: submission.grade, teacherComment: submission.feedback === null ? null : sanitizeRichText(submission.feedback),
  createdAt: isoOrEpoch(submission.createdAt),
  gradedAt: submission.status === 'graded' ? isoOrEpoch(submission.updatedAt ?? submission.createdAt) : null,
  assets: [],
  ...(legacyAssetId(submission.fileUrl) && submission.fileName
    ? { legacyAttachment: { assetId: legacyAssetId(submission.fileUrl)!, fileName: submission.fileName } } : {}),
});

const mergedSubmissions = (legacy: readonly LegacyHomeworkSubmission[], current: readonly NonNullable<Awaited<ReturnType<typeof getSandboxHomework>>>[]) => {
  const items = [...legacy.map(outputLegacySubmission), ...current.map(item => outputSubmission(item)!)];
  return items.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
};

export const createSandboxHomeworkApp = (dependencies: SandboxHomeworkAppDependencies): Express => {
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  const controlSchemaReady = dependencies.schemaReady ?? initializeSandboxStudentControlSchema(dependencies.writeDatabase);
  const enrollmentSchemaReady = dependencies.schemaReady ?? initializeSandboxEnrollmentSchema(dependencies.writeDatabase);
  const assetsReady = dependencies.schemaReady ?? initializeSandboxAssetSchema(dependencies.writeDatabase);
  const homeworkReady = dependencies.schemaReady ?? initializeSandboxHomeworkSchema(dependencies.writeDatabase);
  const draftsReady = dependencies.schemaReady ?? initializeSandboxLessonDraftSchema(dependencies.writeDatabase);
  const lessonsReady = dependencies.schemaReady ?? initializeSandboxLessonSchema(dependencies.writeDatabase);

  const currentUser = async (response: Response) => {
    const repositories = createLegacyReadRepositories(dependencies.readDatabase);
    return {
      repositories,
      user: await repositories.getUserByTelegramId(response.locals.telegram.telegramId),
    };
  };

  app.post('/api/v2/sandbox/lessons/:lessonId/homework', auth, async (request, response, next) => {
    try {
      await Promise.all([controlSchemaReady, enrollmentSchemaReady, assetsReady, homeworkReady, draftsReady, lessonsReady]);
      const lessonId = lessonIdOf(request);
      if (lessonId === null) return errorBody('VALIDATION_FAILED', 'Некоректний lessonId', 400, response);
      const parsed = submitHomeworkRequestSchema.safeParse(request.body);
      if (!parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректне тіло homework', 400, response);
      const { repositories, user } = await currentUser(response);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      if (user.role !== 'student') return errorBody('FORBIDDEN', 'Homework доступний лише учню', 403, response);
      const selectedCourseId = await getSandboxEnrollment(dependencies.writeDatabase, user.id) ?? user.enrolledCourseId;
      if (selectedCourseId === null) return errorBody('NOT_FOUND', 'Курс не обрано', 404, response);
      const lesson = await getEffectiveLesson(dependencies.writeDatabase, lessonId, await repositories.getLesson(lessonId));
      if (!lesson || lesson.courseId !== selectedCourseId) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      if (!lesson.blocks.some((block) => block.type === 'homework')) return errorBody('CONTENT_INVALID', 'У цьому уроці немає homework', 422, response);
      const assets = [];
      for (const reference of parsed.data.assets) {
        const asset = await getOwnedAsset(dependencies.writeDatabase, reference.assetId, user.id, false);
        if (!asset) return errorBody('NOT_FOUND', 'Вкладення не знайдено або воно належить іншому учню', 404, response);
        assets.push({ assetId: asset.assetId, storageKey: asset.assetId, mimeType: asset.mimeType, bytes: asset.bytes, sha256: asset.sha256, fileName: asset.fileName });
      }
      const answerText = sanitizeRichText(parsed.data.answerHtml);
      if (!answerText.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() && !assets.length) {
        return errorBody('VALIDATION_FAILED', 'Додай відповідь або файл', 400, response);
      }

      const submission = await submitSandboxHomework(dependencies.writeDatabase, {
        submissionId: parsed.data.submissionId,
        userId: user.id,
        lessonId,
        answerText,
        createdAt: new Date().toISOString(),
        assets,
      });
      response.status(201).json(homeworkSubmissionSchema.parse(outputSubmission(submission)));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v2/sandbox/lessons/:lessonId/homework', auth, async (request, response, next) => {
    try {
      await Promise.all([controlSchemaReady, enrollmentSchemaReady, assetsReady, homeworkReady, draftsReady, lessonsReady]);
      const lessonId = lessonIdOf(request);
      if (lessonId === null) return errorBody('VALIDATION_FAILED', 'Некоректний lessonId', 400, response);
      const { repositories, user } = await currentUser(response);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      const selectedCourseId = await getSandboxEnrollment(dependencies.writeDatabase, user.id) ?? user.enrolledCourseId;
      const lesson = await getEffectiveLesson(dependencies.writeDatabase, lessonId, await repositories.getLesson(lessonId));
      if (!lesson || user.role !== 'student' || lesson.courseId !== selectedCourseId) return errorBody('NOT_FOUND', 'Урок не знайдено', 404, response);
      const prompt = lesson.blocks.find(block => block.type === 'homework');
      if (!prompt || prompt.type !== 'homework') return errorBody('NOT_FOUND', 'Домашнього завдання немає', 404, response);
      const current = await listSandboxHomework(dependencies.writeDatabase, { userId: user.id });
      const legacy = await repositories.listHomeworkForUser(user.id);
      const submission = mergedSubmissions(legacy.filter(item => item.lessonId === lessonId), current.filter(item => item.lessonId === lessonId))[0] ?? null;
      response.json(homeworkPromptResponseSchema.parse({ lessonId, promptHtml: prompt.promptHtml, submission }));
    } catch (error) { next(error); }
  });

  app.get('/api/v2/sandbox/me/homework', auth, async (_request, response, next) => {
    try {
      await Promise.all([controlSchemaReady, homeworkReady]);
      const { repositories, user } = await currentUser(response);
      if (!user) return errorBody('NOT_FOUND', 'Користувача не знайдено', 404, response);
      if (user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, user.id)) return errorBody('BLOCKED', 'Доступ заблоковано', 403, response);
      if (user.role !== 'student') return errorBody('FORBIDDEN', 'Homework учня недоступний у teacher preview', 403, response);
      const items = await listSandboxHomework(dependencies.writeDatabase, { userId: user.id });
      response.json(homeworkListResponseSchema.parse({ items: mergedSubmissions(await repositories.listHomeworkForUser(user.id), items) }));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v2/sandbox/teacher/homework', auth, async (request, response, next) => {
    try {
      await Promise.all([controlSchemaReady, homeworkReady]);
      const { repositories, user } = await currentUser(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const status = request.query.status;
      if (status !== undefined && status !== 'pending' && status !== 'graded') return errorBody('VALIDATION_FAILED', 'Некоректний статус homework', 400, response);
      const typedStatus = status as 'pending' | 'graded' | undefined;
      const items = await listSandboxHomework(dependencies.writeDatabase, { status: typedStatus });
      response.json(homeworkListResponseSchema.parse({ items: mergedSubmissions(await repositories.listHomeworkForTeacher(typedStatus), items) }));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/v2/sandbox/teacher/homework/:submissionId/grade', auth, async (request, response, next) => {
    try {
      await Promise.all([controlSchemaReady, homeworkReady]);
      const submissionId = typeof request.params.submissionId === 'string' ? request.params.submissionId : '';
      const parsed = gradeHomeworkRequestSchema.safeParse(request.body);
      if (!submissionId || !parsed.success) return errorBody('VALIDATION_FAILED', 'Некоректна grading команда', 400, response);
      const { repositories, user } = await currentUser(response);
      if (!user || user.role !== 'teacher' || user.isBlocked) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const existing = await getSandboxHomework(dependencies.writeDatabase, submissionId);
      if (!existing) {
        const legacyId = /^\d+$/.test(submissionId) ? Number(submissionId) : NaN;
        const legacy = Number.isSafeInteger(legacyId) ? await repositories.getHomeworkById(legacyId) : null;
        if (!legacy) return errorBody('NOT_FOUND', 'Homework не знайдено', 404, response);
        const teacherComment = sanitizeRichText(parsed.data.teacherComment);
        const gradedAt = new Date().toISOString();
        await dependencies.writeDatabase.execute({
          sql: `UPDATE homework_submissions SET grade = ?, feedback = ?, status = 'graded', updated_at = ? WHERE id = ?`,
          args: [parsed.data.grade, teacherComment, gradedAt, legacy.id],
        });
        return response.json(homeworkSubmissionSchema.parse(outputLegacySubmission({
          ...legacy, grade: parsed.data.grade, feedback: teacherComment, status: 'graded', updatedAt: gradedAt,
        })));
      }
      const graded = await gradeSandboxHomework(dependencies.writeDatabase, {
        submissionId,
        grade: parsed.data.grade,
        teacherComment: sanitizeRichText(parsed.data.teacherComment),
        gradedAt: new Date().toISOString(),
      });
      response.json(homeworkSubmissionSchema.parse(outputSubmission(graded)));
    } catch (error) {
      next(error);
    }
  });

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox homework API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    if (error instanceof HomeworkConflictError) return errorBody('CONFLICT', 'Роботу вже перевірено або її стан змінився. Оновіть сторінку.', 409, response);
    console.error(`[v3 sandbox homework api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
