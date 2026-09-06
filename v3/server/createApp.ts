import express, { type Express } from 'express';
import { randomUUID } from 'node:crypto';
import {
  courseListResponseSchema,
  coursePathResponseSchema,
  dictionaryResponseSchema,
  homeworkListResponseSchema,
  homeworkPromptResponseSchema,
  homeworkSubmissionSchema,
  meCourseResponseSchema,
  lessonResponseSchema,
  meResponseSchema,
  teacherStatisticsResponseSchema,
  studySessionResponseSchema,
  teacherCoursesResponseSchema,
  teacherLessonsResponseSchema,
  teacherStudentDetailsResponseSchema,
  teacherStudentsResponseSchema,
} from '../src/api/contracts.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import {
  createReadOnlyDatabaseFromEnv,
  type ReadOnlyDatabase,
} from './infrastructure/db/readOnlySql.js';
import { normalizeLessonBlocks, sanitizeRichText } from './modules/lessons/normalizeBlock.js';
import { deriveCoursePath } from './modules/progress/coursePath.js';

export type AppDependencies = {
  database?: ReadOnlyDatabase | null;
  botToken?: string;
};

const teacherCapabilities = [
  'teacher:manage_courses',
  'teacher:manage_lessons',
  'teacher:grade_homework',
  'teacher:manage_students',
  'teacher:chat',
  'teacher:manage_broadcasts',
  'teacher:read_statistics',
] as const;

const studentCapabilities = ['student:learn', 'student:submit_homework'] as const;

const courseView = (course: Awaited<ReturnType<ReturnType<typeof createLegacyReadRepositories>['listCourses']>>[number]) => ({
  courseId: course.id,
  title: course.title,
  description: course.description,
  order: course.order,
  lessonCount: course.lessonCount,
});

const flashcardView = (card: Awaited<ReturnType<ReturnType<typeof createLegacyReadRepositories>['listFlashcardsForUser']>>[number]) => ({
  flashcardId: card.id,
  lessonId: card.lessonId,
  lessonTitle: card.lessonTitle,
  front: card.front,
  back: card.back,
  examplePhrase: card.examplePhrase,
  timesShown: card.timesShown,
  timesCorrect: card.timesCorrect,
  timesWrong: card.timesWrong,
  easeFactor: card.easeFactor,
  intervalDays: card.intervalDays,
  nextReviewAt: card.nextReviewAt && !Number.isNaN(Date.parse(card.nextReviewAt))
    ? new Date(card.nextReviewAt).toISOString()
    : null,
});

const isoOrEpoch = (value: string | null): string => {
  const date = value ? new Date(value) : new Date(0);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

const legacyHomeworkView = (submission: Awaited<ReturnType<ReturnType<typeof createLegacyReadRepositories>['listHomeworkForUser']>>[number]) => ({
  submissionId: String(submission.id),
  userId: submission.userId,
  lessonId: submission.lessonId,
  answerHtml: sanitizeRichText(submission.answerText),
  status: submission.status,
  grade: submission.grade,
  teacherComment: submission.feedback === null ? null : sanitizeRichText(submission.feedback),
  createdAt: isoOrEpoch(submission.createdAt),
  gradedAt: submission.status === 'graded' ? isoOrEpoch(submission.updatedAt ?? submission.createdAt) : null,
  assets: [],
});

export const createApp = (dependencies: AppDependencies = {}): Express => {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  const database = dependencies.database === undefined
    ? createReadOnlyDatabaseFromEnv()
    : dependencies.database;
  const botToken = dependencies.botToken ?? process.env.TELEGRAM_BOT_TOKEN;

  // This endpoint deliberately has no database dependency. It is the first
  // safe deployment probe for the new API runtime.
  app.get('/api/v2/health', (_request, response) => {
    response.json({
      status: 'ok',
      service: 'english-with-coffee-api',
      apiVersion: 'v2',
    });
  });

  app.get('/api/v2/assets/:assetId', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const assetId = typeof request.params.assetId === 'string' ? request.params.assetId : '';
    if (!assetId || assetId.length > 160 || /[\0/]/.test(assetId)) {
      response.status(400).json({ code: 'VALIDATION_FAILED', message: 'Некоректний assetId', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Користувача не знайдено', requestId: randomUUID() });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({ code: 'BLOCKED', message: 'Доступ заблоковано', requestId: randomUUID() });
      return;
    }
    if (user.role === 'student') {
      if (user.enrolledCourseId === null || !(await repositories.isAssetReferencedByCourse(assetId, user.enrolledCourseId))) {
        response.status(404).json({ code: 'NOT_FOUND', message: 'Медіафайл не знайдено', requestId: randomUUID() });
        return;
      }
    }
    const asset = await repositories.getAsset(assetId);
    if (!asset) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Медіафайл не знайдено', requestId: randomUUID() });
      return;
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(asset.base64Data)) {
      response.status(500).json({ code: 'INTERNAL', message: 'Медіафайл має пошкоджений формат', requestId: randomUUID() });
      return;
    }
    response.setHeader('Content-Type', asset.mimeType || 'application/octet-stream');
    response.setHeader('Content-Length', String(Buffer.byteLength(asset.base64Data, 'base64')));
    response.setHeader('Cache-Control', 'private, max-age=3600');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.send(Buffer.from(asset.base64Data, 'base64'));
  });

  app.get('/api/v2/me/dictionary', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const user = await createLegacyReadRepositories(database)
      .getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Користувача не знайдено', requestId: randomUUID() });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({ code: 'BLOCKED', message: 'Доступ заблоковано', requestId: randomUUID() });
      return;
    }
    if (user.role !== 'student') {
      response.status(403).json({ code: 'FORBIDDEN', message: 'Словник учня недоступний у teacher preview', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    response.json(dictionaryResponseSchema.parse({ items: (await repositories.listFlashcardsForUser(user)).map(flashcardView) }));
  });

  app.get('/api/v2/me/study-session', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const rawLimit = request.query.limit;
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      response.status(400).json({ code: 'VALIDATION_FAILED', message: 'Ліміт має бути цілим числом від 1 до 20', requestId: randomUUID() });
      return;
    }
    const user = await createLegacyReadRepositories(database)
      .getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Користувача не знайдено', requestId: randomUUID() });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({ code: 'BLOCKED', message: 'Доступ заблоковано', requestId: randomUUID() });
      return;
    }
    if (user.role !== 'student') {
      response.status(403).json({ code: 'FORBIDDEN', message: 'SRS недоступний у teacher preview', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    response.json(studySessionResponseSchema.parse({ items: (await repositories.listFlashcardsForUser(user, limit)).map(flashcardView) }));
  });

  app.get('/api/v2/courses', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Користувача не знайдено', requestId: randomUUID() });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({ code: 'BLOCKED', message: 'Доступ заблоковано', requestId: randomUUID() });
      return;
    }
    response.json(courseListResponseSchema.parse({ items: (await repositories.listCourses()).map(courseView) }));
  });

  app.get('/api/v2/me/course', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Користувача не знайдено', requestId: randomUUID() });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({ code: 'BLOCKED', message: 'Доступ заблоковано', requestId: randomUUID() });
      return;
    }
    if (user.role !== 'student' || user.enrolledCourseId === null) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Курс не обрано', requestId: randomUUID() });
      return;
    }
    const course = await repositories.getCourseById(user.enrolledCourseId);
    if (!course) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Курс не знайдено', requestId: randomUUID() });
      return;
    }
    const path = deriveCoursePath(user, await repositories.getCoursePath(course.id, user.id));
    const completedLessons = path.items.filter((item) => item.status === 'completed').length;
    const nextLessonId = path.items.find((item) => item.status === 'available')?.lessonId ?? null;
    response.json(meCourseResponseSchema.parse({ course: courseView(course), completedLessons, totalLessons: path.items.length, nextLessonId }));
  });

  app.get('/api/v2/lessons/:lessonId/homework', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const lessonId = Number(request.params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      response.status(400).json({ code: 'VALIDATION_FAILED', message: 'Некоректний ідентифікатор уроку', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Користувача не знайдено', requestId: randomUUID() });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({ code: 'BLOCKED', message: 'Доступ заблоковано', requestId: randomUUID() });
      return;
    }
    if (user.role !== 'student' || user.enrolledCourseId === null) {
      response.status(403).json({ code: 'FORBIDDEN', message: 'Homework доступний лише учню з курсом', requestId: randomUUID() });
      return;
    }
    const lesson = await repositories.getLesson(lessonId);
    if (!lesson || lesson.courseId !== user.enrolledCourseId) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Урок не знайдено', requestId: randomUUID() });
      return;
    }
    const path = deriveCoursePath(user, await repositories.getCoursePath(lesson.courseId, user.id));
    const lessonState = path.items.find((item) => item.lessonId === lessonId);
    if (!lessonState || lessonState.status === 'locked') {
      response.status(403).json({ code: 'FORBIDDEN', message: 'Урок ще недоступний', requestId: randomUUID() });
      return;
    }
    const prompt = normalizeLessonBlocks(lesson.blocks).find((block) => block.type === 'homework');
    if (!prompt || prompt.type !== 'homework') {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Homework для уроку не знайдено', requestId: randomUUID() });
      return;
    }
    const submission = (await repositories.listHomeworkForUser(user.id)).find((item) => item.lessonId === lessonId) ?? null;
    response.json(homeworkPromptResponseSchema.parse({ lessonId, promptHtml: prompt.promptHtml, submission: submission ? legacyHomeworkView(submission) : null }));
  });

  app.get('/api/v2/me/homework', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!user) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Користувача не знайдено', requestId: randomUUID() });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({ code: 'BLOCKED', message: 'Доступ заблоковано', requestId: randomUUID() });
      return;
    }
    if (user.role !== 'student') {
      response.status(403).json({ code: 'FORBIDDEN', message: 'Homework учня недоступний у teacher preview', requestId: randomUUID() });
      return;
    }
    response.json(homeworkListResponseSchema.parse({ items: (await repositories.listHomeworkForUser(user.id)).map(legacyHomeworkView) }));
  });

  app.get('/api/v2/teacher/homework', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const status = request.query.status;
    if (status !== undefined && status !== 'pending' && status !== 'graded') {
      response.status(400).json({ code: 'VALIDATION_FAILED', message: 'Некоректний статус homework', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const teacher = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!teacher || teacher.role !== 'teacher' || teacher.isBlocked) {
      response.status(403).json({ code: 'FORBIDDEN', message: 'Недостатньо прав для homework', requestId: randomUUID() });
      return;
    }
    response.json(homeworkListResponseSchema.parse({ items: (await repositories.listHomeworkForTeacher(status as 'pending' | 'graded' | undefined)).map(legacyHomeworkView) }));
  });

  app.get('/api/v2/teacher/homework/:submissionId', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const submissionId = Number(request.params.submissionId);
    if (!Number.isInteger(submissionId) || submissionId <= 0) {
      response.status(400).json({ code: 'VALIDATION_FAILED', message: 'Некоректний submissionId', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const teacher = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!teacher || teacher.role !== 'teacher' || teacher.isBlocked) {
      response.status(403).json({ code: 'FORBIDDEN', message: 'Недостатньо прав для homework', requestId: randomUUID() });
      return;
    }
    const submission = await repositories.getHomeworkById(submissionId);
    if (!submission) {
      response.status(404).json({ code: 'NOT_FOUND', message: 'Homework не знайдено', requestId: randomUUID() });
      return;
    }
    response.json(homeworkSubmissionSchema.parse(legacyHomeworkView(submission)));
  });

  app.get('/api/v2/teacher/courses', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Telegram authentication is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Read-only database is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    const identity = response.locals.telegram;
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(identity.telegramId);
    if (!user || user.role !== 'teacher') {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Недостатньо прав для кабінету викладача',
        requestId: randomUUID(),
      });
      return;
    }
    response.json(teacherCoursesResponseSchema.parse({
      items: await repositories.listCourses().then((courses) => courses.map((course) => ({
        courseId: course.id,
        title: course.title,
        description: course.description,
        order: course.order,
        lessonCount: course.lessonCount,
      }))),
    }));
  });

  app.get('/api/v2/teacher/students', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Telegram authentication is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Read-only database is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const teacher = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!teacher || teacher.role !== 'teacher') {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Недостатньо прав для списку студентів',
        requestId: randomUUID(),
      });
      return;
    }
    response.json(teacherStudentsResponseSchema.parse({
      items: (await repositories.listStudents()).map((student) => ({
        studentId: student.id,
        name: student.name,
        username: student.username,
        isBlocked: student.isBlocked,
        enrolledCourseId: student.enrolledCourseId,
      })),
    }));
  });

  app.get('/api/v2/teacher/students/:studentId', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Telegram authentication is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Read-only database is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    const studentId = Number(request.params.studentId);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      response.status(400).json({
        code: 'VALIDATION_FAILED',
        message: 'Некоректний ідентифікатор студента',
        requestId: randomUUID(),
      });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const teacher = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!teacher || teacher.role !== 'teacher') {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Недостатньо прав для перегляду студента',
        requestId: randomUUID(),
      });
      return;
    }
    const overview = await repositories.getStudentOverview(studentId);
    if (!overview) {
      response.status(404).json({
        code: 'NOT_FOUND',
        message: 'Студента не знайдено',
        requestId: randomUUID(),
      });
      return;
    }
    response.json(teacherStudentDetailsResponseSchema.parse({
      item: {
        studentId: overview.user.id,
        name: overview.user.name,
        username: overview.user.username,
        isBlocked: overview.user.isBlocked,
        enrolledCourseId: overview.user.enrolledCourseId,
        completedLessons: overview.completedLessons,
        totalLessons: overview.totalLessons,
        averageScore: overview.averageScore,
        pendingHomework: overview.pendingHomework,
      },
    }));
  });

  app.get('/api/v2/teacher/statistics', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({ code: 'INTERNAL', message: 'Telegram authentication is not configured', requestId: randomUUID() });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({ code: 'INTERNAL', message: 'Read-only database is not configured', requestId: randomUUID() });
      return;
    }
    const repositories = createLegacyReadRepositories(database);
    const teacher = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    if (!teacher || teacher.role !== 'teacher') {
      response.status(403).json({ code: 'FORBIDDEN', message: 'Недостатньо прав для статистики', requestId: randomUUID() });
      return;
    }
    response.json(teacherStatisticsResponseSchema.parse({ item: await repositories.getTeacherStatistics() }));
  });

  app.get('/api/v2/teacher/courses/:courseId/lessons', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Telegram authentication is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Read-only database is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    const courseId = Number(request.params.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      response.status(400).json({
        code: 'VALIDATION_FAILED',
        message: 'Некоректний ідентифікатор курсу',
        requestId: randomUUID(),
      });
      return;
    }
    const identity = response.locals.telegram;
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(identity.telegramId);
    if (!user || user.role !== 'teacher') {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Недостатньо прав для кабінету викладача',
        requestId: randomUUID(),
      });
      return;
    }
    const items = await repositories.listLessonSummaries(courseId);
    response.json(teacherLessonsResponseSchema.parse({
      courseId,
      items: items.map((item) => ({
        lessonId: item.id,
        title: item.title,
        order: item.order,
        blockCount: item.blockCount,
        hasHomework: item.hasHomework,
      })),
    }));
  });

  app.get('/api/v2/me', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Telegram authentication is not configured',
        requestId: randomUUID(),
      });
      return;
    }

    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Read-only database is not configured',
        requestId: randomUUID(),
      });
      return;
    }

    const identity = response.locals.telegram;
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(identity.telegramId);
    if (!user) {
      response.status(404).json({
        code: 'NOT_FOUND',
        message: 'Користувача не знайдено',
        requestId: randomUUID(),
      });
      return;
    }

    const capabilities = user.role === 'teacher' ? teacherCapabilities : studentCapabilities;
    const parsed = meResponseSchema.parse({
      userId: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      isBlocked: user.isBlocked,
      capabilities,
      enrollment: { courseId: user.enrolledCourseId },
    });
    response.json(parsed);
  });

  app.get('/api/v2/me/course/path', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Telegram authentication is not configured',
        requestId: randomUUID(),
      });
      return;
    }

    requireTelegramAuth({ botToken })(request, response, next);
  }, async (_request, response) => {
    if (!database) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Read-only database is not configured',
        requestId: randomUUID(),
      });
      return;
    }

    const identity = response.locals.telegram;
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(identity.telegramId);
    if (!user) {
      response.status(404).json({
        code: 'NOT_FOUND',
        message: 'Користувача не знайдено',
        requestId: randomUUID(),
      });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({
        code: 'BLOCKED',
        message: 'Доступ до курсу заблоковано',
        requestId: randomUUID(),
      });
      return;
    }
    if (user.enrolledCourseId === null) {
      response.status(404).json({
        code: 'NOT_FOUND',
        message: 'Курс не обрано',
        requestId: randomUUID(),
      });
      return;
    }

    const records = await repositories.getCoursePath(user.enrolledCourseId, user.id);
    response.json(coursePathResponseSchema.parse(deriveCoursePath(user, records)));
  });

  app.get('/api/v2/lessons/:lessonId', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Telegram authentication is not configured',
        requestId: randomUUID(),
      });
      return;
    }

    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Read-only database is not configured',
        requestId: randomUUID(),
      });
      return;
    }

    const lessonId = Number(request.params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      response.status(400).json({
        code: 'VALIDATION_FAILED',
        message: 'Некоректний ідентифікатор уроку',
        requestId: randomUUID(),
      });
      return;
    }

    const identity = response.locals.telegram;
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(identity.telegramId);
    if (!user) {
      response.status(404).json({
        code: 'NOT_FOUND',
        message: 'Користувача не знайдено',
        requestId: randomUUID(),
      });
      return;
    }
    if (user.isBlocked) {
      response.status(403).json({
        code: 'BLOCKED',
        message: 'Доступ заблоковано',
        requestId: randomUUID(),
      });
      return;
    }

    const lesson = await repositories.getLesson(lessonId);
    if (!lesson) {
      response.status(404).json({
        code: 'NOT_FOUND',
        message: 'Урок не знайдено',
        requestId: randomUUID(),
      });
      return;
    }

    if (user.role === 'student') {
      if (user.enrolledCourseId !== lesson.courseId) {
        response.status(404).json({
          code: 'NOT_FOUND',
          message: 'Урок не знайдено',
          requestId: randomUUID(),
        });
        return;
      }
      const records = await repositories.getCoursePath(lesson.courseId, user.id);
      const path = deriveCoursePath(user, records);
      const lessonState = path.items.find((item) => item.lessonId === lessonId);
      if (!lessonState || lessonState.status === 'locked') {
        response.status(403).json({
          code: 'FORBIDDEN',
          message: 'Урок ще недоступний',
          requestId: randomUUID(),
        });
        return;
      }
    }

    const parsed = lessonResponseSchema.parse({
      lessonId: lesson.id,
      title: lesson.title,
      contentRevision: `legacy-${lesson.id}`,
      blocks: normalizeLessonBlocks(lesson.blocks),
    });
    response.json(parsed);
  });

  app.get('/api/v2/teacher/lessons/:lessonId', (request, response, next) => {
    if (!botToken) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Telegram authentication is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    requireTelegramAuth({ botToken })(request, response, next);
  }, async (request, response) => {
    if (!database) {
      response.status(503).json({
        code: 'INTERNAL',
        message: 'Read-only database is not configured',
        requestId: randomUUID(),
      });
      return;
    }
    const lessonId = Number(request.params.lessonId);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      response.status(400).json({
        code: 'VALIDATION_FAILED',
        message: 'Некоректний ідентифікатор уроку',
        requestId: randomUUID(),
      });
      return;
    }
    const identity = response.locals.telegram;
    const repositories = createLegacyReadRepositories(database);
    const user = await repositories.getUserByTelegramId(identity.telegramId);
    if (!user || user.role !== 'teacher') {
      response.status(403).json({
        code: 'FORBIDDEN',
        message: 'Недостатньо прав для редактора уроків',
        requestId: randomUUID(),
      });
      return;
    }
    const lesson = await repositories.getLesson(lessonId);
    if (!lesson) {
      response.status(404).json({
        code: 'NOT_FOUND',
        message: 'Урок не знайдено',
        requestId: randomUUID(),
      });
      return;
    }
    response.json(lessonResponseSchema.parse({
      lessonId: lesson.id,
      title: lesson.title,
      contentRevision: `legacy-${lesson.id}`,
      blocks: normalizeLessonBlocks(lesson.blocks),
    }));
  });

  app.use((_request, response) => {
    response.status(404).json({
      code: 'NOT_FOUND',
      message: 'API-маршрут не знайдено',
      requestId: randomUUID(),
    });
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[v3 api] ${message}`);
    response.status(500).json({
      code: 'INTERNAL',
      message: 'Внутрішня помилка сервера',
      requestId: randomUUID(),
    });
  });

  return app;
};
