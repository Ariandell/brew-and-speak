import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { randomUUID } from 'node:crypto';
import {
  teacherStudentDetailsResponseSchema,
  teacherStudentsResponseSchema,
} from '../src/api/contracts.js';
import { assertSandboxDatabaseUrl } from './infrastructure/db/sandboxGuard.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import type { SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { initializeSandboxStudentControlSchema, isSandboxUserBlocked, setSandboxStudentBlocked } from './modules/teacher/sandboxStudentControlRepository.js';

export type SandboxStudentManagementAppDependencies = {
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

const studentIdOf = (request: Request): number | null => {
  const id = Number(request.params.studentId);
  return Number.isInteger(id) && id > 0 ? id : null;
};

export const createSandboxStudentManagementApp = (dependencies: SandboxStudentManagementAppDependencies): Express => {
  if (dependencies.runtime !== 'production') assertSandboxDatabaseUrl(dependencies.writeDatabaseUrl);
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  const auth = requireTelegramAuth({ botToken: dependencies.botToken });
  const schemaReady = dependencies.schemaReady ?? initializeSandboxStudentControlSchema(dependencies.writeDatabase);

  const teacherContext = async (response: Response) => {
    const repositories = createLegacyReadRepositories(dependencies.readDatabase);
    const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
    return user && user.role === 'teacher' && !user.isBlocked ? { user, repositories } : null;
  };

  app.get('/api/v2/sandbox/teacher/students', auth, async (_request, response, next) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const students = await context.repositories.listStudents();
      response.json(teacherStudentsResponseSchema.parse({
        items: await Promise.all(students.map(async (student) => ({
          studentId: student.id,
          name: student.name,
          username: student.username,
          isBlocked: student.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, student.id),
          enrolledCourseId: student.enrolledCourseId,
        }))),
      }));
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/v2/sandbox/teacher/students/:studentId', auth, async (request, response, next) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const studentId = studentIdOf(request);
      if (studentId === null) return errorBody('VALIDATION_FAILED', 'Некоректний studentId', 400, response);
      const overview = await context.repositories.getStudentOverview(studentId);
      if (!overview) return errorBody('NOT_FOUND', 'Студента не знайдено', 404, response);
      response.json(teacherStudentDetailsResponseSchema.parse({ item: {
        studentId: overview.user.id,
        name: overview.user.name,
        username: overview.user.username,
        isBlocked: overview.user.isBlocked || await isSandboxUserBlocked(dependencies.writeDatabase, overview.user.id),
        enrolledCourseId: overview.user.enrolledCourseId,
        completedLessons: overview.completedLessons,
        totalLessons: overview.totalLessons,
        averageScore: overview.averageScore,
        pendingHomework: overview.pendingHomework,
      } }));
    } catch (error) {
      next(error);
    }
  });

  const setBlocked = (blocked: boolean) => async (request: Request, response: Response, next: NextFunction) => {
    try {
      await schemaReady;
      const context = await teacherContext(response);
      if (!context) return errorBody('FORBIDDEN', 'Недостатньо прав викладача', 403, response);
      const studentId = studentIdOf(request);
      if (studentId === null) return errorBody('VALIDATION_FAILED', 'Некоректний studentId', 400, response);
      const student = await context.repositories.getUserById(studentId);
      if (!student || student.role !== 'student') return errorBody('NOT_FOUND', 'Студента не знайдено', 404, response);
      const effectiveBlocked = await setSandboxStudentBlocked(dependencies.writeDatabase, {
        studentId,
        blocked,
        updatedBy: context.user.id,
        updatedAt: new Date().toISOString(),
      });
      response.json({ studentId, isBlocked: student.isBlocked || effectiveBlocked });
    } catch (error) {
      next(error);
    }
  };

  app.post('/api/v2/sandbox/teacher/students/:studentId/block', auth, setBlocked(true));
  app.post('/api/v2/sandbox/teacher/students/:studentId/unblock', auth, setBlocked(false));

  app.use((_request, response) => errorBody('NOT_FOUND', 'Sandbox student API-маршрут не знайдено', 404, response));
  app.use((error: unknown, _request: Request, response: Response, next: NextFunction) => {
    if (response.headersSent) return next(error);
    console.error(`[v3 sandbox student api] ${error instanceof Error ? error.message : String(error)}`);
    errorBody('INTERNAL', 'Внутрішня помилка сервера', 500, response);
  });
  return app;
};
