import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createApp } from './createApp.js';
import { createSandboxAttemptApp } from './createSandboxAttemptApp.js';
import { createSandboxCommunicationApp } from './createSandboxCommunicationApp.js';
import { createSandboxCourseApp } from './createSandboxCourseApp.js';
import { createSandboxEnrollmentApp } from './createSandboxEnrollmentApp.js';
import { createSandboxHomeworkApp } from './createSandboxHomeworkApp.js';
import { createSandboxMediaApp } from './createSandboxMediaApp.js';
import { createSandboxSrsApp } from './createSandboxSrsApp.js';
import { createSandboxStudentManagementApp } from './createSandboxStudentManagementApp.js';
import { createSandboxTeacherApp } from './createSandboxTeacherApp.js';
import { createReadOnlyDatabaseFromEnv, type ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createWriteDatabaseFromEnv, type WriteDatabase } from './infrastructure/db/writeSql.js';
import { requireTelegramAuth } from './infrastructure/telegram/authMiddleware.js';
import { PRODUCTION_SCHEMA_PLAN } from './infrastructure/db/schemaVersion.js';
import { calculateActivityStreak } from './modules/progress/streak.js';
import { createLegacyReadRepositories } from './modules/legacy/repositories.js';
import { activityStreakResponseSchema } from '../src/api/contracts.js';
import { meResponseSchema } from '../src/api/contracts.js';
import { getSandboxEnrollment } from './modules/courses/sandboxEnrollmentRepository.js';
import { isSandboxUserBlocked } from './modules/teacher/sandboxStudentControlRepository.js';
import { collectLegacyInventory } from './infrastructure/db/legacyInventory.js';
import { applyV3MigrationPlan } from './infrastructure/db/sandboxMigrationPlan.js';

export type ProductionAppDependencies = {
  readDatabase?: ReadOnlyDatabase | null;
  writeDatabase?: WriteDatabase | null;
  databaseUrl?: string;
  botToken?: string;
  writesEnabled?: boolean;
};

const rewriteForModule = (app: Express) => (request: Request, response: Response, next: NextFunction) => {
  const original = request.url;
  request.url = request.url.replace(/^\/api\/v2(?=\/|$)/, '/api/v2/sandbox');
  app(request, response, (error?: unknown) => {
    request.url = original;
    next(error);
  });
};

/**
 * Production composition. Legacy reads and additive V3 writes share canonical
 * /api/v2 contracts. Writes fail closed unless the explicit feature gate and
 * verified schema marker are both present; the sandbox path is only an internal
 * module namespace and is never exposed to product callers.
 */
export const createProductionApp = (dependencies: ProductionAppDependencies = {}): Express => {
  const databaseUrl = dependencies.databaseUrl ?? process.env.TURSO_DATABASE_URL ?? '';
  const botToken = dependencies.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
  const writesEnabled = dependencies.writesEnabled ?? process.env.V3_WRITES_ENABLED === 'true';
  // A malformed deployment variable must never crash the serverless function at
  // module evaluation time. Keep health available and let the normal API return
  // a controlled 503 until the configuration is corrected.
  let databaseConfigurationError: unknown = null;
  let readDatabase: ReadOnlyDatabase | null = dependencies.readDatabase ?? null;
  let writeDatabase: WriteDatabase | null = dependencies.writeDatabase ?? null;
  try {
    if (dependencies.readDatabase === undefined) readDatabase = createReadOnlyDatabaseFromEnv();
    // Do not construct a write-capable client while the production write gate is closed.
    if (writesEnabled && dependencies.writeDatabase === undefined) writeDatabase = createWriteDatabaseFromEnv();
  } catch (error) {
    databaseConfigurationError = error;
    readDatabase = null;
    writeDatabase = null;
    console.error('[production-api] database client initialization failed', error);
  }
  const app = express();
  app.disable('x-powered-by');

  // Temporary, fail-closed cutover route. It is active only while a one-time
  // deployment secret exists and refuses to migrate any database whose legacy
  // fingerprint differs from the verified local backup.
  app.all('/api/v2/internal/v3-cutover', async (request, response) => {
    const expectedKey = process.env.V3_MIGRATION_KEY ?? '';
    const suppliedKey = request.header('x-v3-migration-key') ?? '';
    const authorized = expectedKey.length >= 32 && suppliedKey.length === expectedKey.length
      && timingSafeEqual(Buffer.from(suppliedKey), Buffer.from(expectedKey));
    if (!authorized) return response.status(404).json({ code: 'NOT_FOUND', message: 'Маршрут не знайдено', requestId: crypto.randomUUID() });
    if (!readDatabase) return response.status(503).json({ code: 'INTERNAL', message: 'Database is not configured', requestId: crypto.randomUUID() });
    try {
      const before = await collectLegacyInventory(readDatabase);
      const expectedFingerprint = '10d5961790e1951dfb1d91a6fe816522a059e20f84e6fbe64a88138d90f6bb64';
      if (request.method === 'GET') return response.json({ inventory: before, matchesVerifiedBackup: before.contentFingerprintSha256 === expectedFingerprint });
      if (request.method !== 'POST') return response.status(405).end();
      if (before.contentFingerprintSha256 !== expectedFingerprint) {
        return response.status(409).json({ code: 'CONFLICT', message: 'Production database does not match the verified backup', requestId: crypto.randomUUID(), inventory: before });
      }
      const migrationDatabase = dependencies.writeDatabase ?? createWriteDatabaseFromEnv();
      if (!migrationDatabase) throw new Error('Write database is not configured');
      try {
        const applied = await applyV3MigrationPlan(migrationDatabase);
        const backupReference = 'brew-db-pre-v3-20260907.db:sha256:6A1B1D5BBE66E37CC4ECDF8BB8F2621B27EE2FB0B6DB0627D7245F15838ABAA7';
        const beforeHash = createHash('sha256').update(JSON.stringify(before)).digest('hex');
        await migrationDatabase.batch([{
          sql: `INSERT INTO v3_backend_meta (key, value) VALUES ('migration_backup_reference', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`, args: [backupReference],
        }, {
          sql: `INSERT INTO v3_backend_meta (key, value) VALUES ('legacy_inventory_before_sha256', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value`, args: [beforeHash],
        }]);
        const after = await collectLegacyInventory(readDatabase);
        if (JSON.stringify(before.rowCounts) !== JSON.stringify(after.rowCounts)
          || before.contentFingerprintSha256 !== after.contentFingerprintSha256) {
          throw new Error('Legacy content changed during additive migration');
        }
        return response.json({ status: 'ok', applied, beforeHash, backupReference, inventory: after });
      } finally {
        if (dependencies.writeDatabase === undefined) migrationDatabase.close();
      }
    } catch (error) {
      console.error('[v3-cutover]', error);
      return response.status(500).json({ code: 'INTERNAL', message: 'Cutover failed', requestId: crypto.randomUUID() });
    }
  });

  app.get('/api/v2/health', (_request, response) => {
    response.status(databaseConfigurationError ? 503 : 200).json({
      status: databaseConfigurationError ? 'degraded' : 'ok',
      service: 'english-with-coffee-api',
      apiVersion: 'v2',
      database: databaseConfigurationError ? 'configuration-error' : (readDatabase ? 'configured' : 'not-configured'),
      writes: writesEnabled ? 'enabled' : 'disabled',
    });
  });

  if (writesEnabled && readDatabase && writeDatabase && botToken && databaseUrl) {
    const schemaReady = writeDatabase.execute({
      sql: `SELECT value FROM v3_backend_meta WHERE key = 'schema_plan'`, args: [],
    }).then(result => {
      if (String(result.rows[0]?.value ?? '') !== PRODUCTION_SCHEMA_PLAN) {
        throw new Error('V3 production schema is not prepared');
      }
    });
    // Attach a handler immediately so a cold-start rejection cannot become an
    // unhandled promise before the first request arrives.
    void schemaReady.catch(() => undefined);
    const shared = { readDatabase, writeDatabase, writeDatabaseUrl: databaseUrl, botToken,
      runtime: 'production' as const, schemaReady };
    const modules = {
      attempts: rewriteForModule(createSandboxAttemptApp(shared)),
      communication: rewriteForModule(createSandboxCommunicationApp(shared)),
      courses: rewriteForModule(createSandboxCourseApp(shared)),
      enrollment: rewriteForModule(createSandboxEnrollmentApp(shared)),
      homework: rewriteForModule(createSandboxHomeworkApp(shared)),
      media: rewriteForModule(createSandboxMediaApp(shared)),
      srs: rewriteForModule(createSandboxSrsApp(shared)),
      students: rewriteForModule(createSandboxStudentManagementApp(shared)),
      teacher: rewriteForModule(createSandboxTeacherApp(shared)),
    };
    const auth = requireTelegramAuth({ botToken });
    app.use('/api/v2', async (request, response, next) => {
      if (request.path === '/health') return next();
      try { await schemaReady; next(); }
      catch {
        response.status(503).json({ code: 'INTERNAL', message: 'V3 database schema is not prepared',
          requestId: crypto.randomUUID() });
      }
    });
    // The first /me read safely provisions a verified Telegram identity. An
    // existing role/block/course is never accepted from or overwritten by the client.
    // Production enrollment and blocking live in additive V3 overlays, so this
    // canonical response must resolve those overlays instead of falling through
    // to the legacy-only /me implementation.
    app.get('/api/v2/me', auth, async (_request, response, next) => {
      try {
        const identity = response.locals.telegram;
        await writeDatabase.execute({
          sql: `INSERT INTO users (telegram_id, name, username, role, is_blocked)
            VALUES (?, ?, ?, 'student', 0)
            ON CONFLICT(telegram_id) DO UPDATE SET
              name = excluded.name,
              username = excluded.username`,
          args: [identity.telegramId, identity.name, identity.username],
        });
        const repositories = createLegacyReadRepositories(readDatabase);
        const user = await repositories.getUserByTelegramId(identity.telegramId);
        if (!user) {
          return response.status(500).json({ code: 'INTERNAL', message: 'Не вдалося створити користувача', requestId: crypto.randomUUID() });
        }
        const isBlocked = user.isBlocked || await isSandboxUserBlocked(writeDatabase, user.id);
        const courseId = await getSandboxEnrollment(writeDatabase, user.id) ?? user.enrolledCourseId;
        response.json(meResponseSchema.parse({
          userId: user.id,
          telegramId: user.telegramId,
          name: user.name,
          username: user.username,
          role: user.role,
          isBlocked,
          enrollment: { courseId },
          capabilities: user.role === 'teacher'
            ? ['teacher:manage_courses', 'teacher:manage_lessons', 'teacher:grade_homework', 'teacher:manage_students',
              'teacher:chat', 'teacher:manage_broadcasts', 'teacher:read_statistics']
            : ['student:learn', 'student:submit_homework'],
        }));
      } catch (error) { next(error); }
    });
    app.get('/api/v2/me/streak', auth, async (_request, response, next) => {
      try {
        const repositories = createLegacyReadRepositories(readDatabase);
        const user = await repositories.getUserByTelegramId(response.locals.telegram.telegramId);
        if (!user) return response.status(404).json({ code: 'NOT_FOUND', message: 'Користувача не знайдено', requestId: crypto.randomUUID() });
        if (user.isBlocked) return response.status(403).json({ code: 'BLOCKED', message: 'Доступ заблоковано', requestId: crypto.randomUUID() });
        const activity = await writeDatabase.execute({
          sql: `SELECT completed_at AS activity_at FROM user_progress
            WHERE user_id = ? AND status = 'completed' AND completed_at IS NOT NULL
            UNION ALL SELECT last_reviewed_at FROM user_flashcard_progress
              WHERE CAST(user_id AS TEXT) IN (?, ?) AND last_reviewed_at IS NOT NULL
            UNION ALL SELECT finished_at FROM v3_attempts
              WHERE user_id = ? AND status = 'finished' AND finished_at IS NOT NULL
            UNION ALL SELECT last_reviewed_at FROM v3_flashcard_progress
              WHERE user_id = ? AND last_reviewed_at IS NOT NULL`,
          args: [user.id, String(user.id), user.telegramId, user.id, user.id],
        });
        response.json(activityStreakResponseSchema.parse({
          streakDays: calculateActivityStreak(activity.rows.map(row => typeof row.activity_at === 'string' ? row.activity_at : null)),
        }));
      } catch (error) { next(error); }
    });
    app.use((request, response, next) => {
      const path = request.path;
      if (path.startsWith('/api/v2/attempts') || path === '/api/v2/me/course/path'
        || (request.method === 'GET' && /^\/api\/v2\/lessons\/\d+$/.test(path))) return modules.attempts(request, response, next);
      if (path.includes('/chat') || path.includes('/photo-messages')) return modules.communication(request, response, next);
      if (path.startsWith('/api/v2/assets') || path.endsWith('/assets')) return modules.media(request, response, next);
      if (path.includes('/homework')) return modules.homework(request, response, next);
      if (path === '/api/v2/me/dictionary' || path === '/api/v2/me/study-session'
        || (path.includes('/flashcards/') && path.endsWith('/review'))) return modules.srs(request, response, next);
      if (path.startsWith('/api/v2/teacher/students')) return modules.students(request, response, next);
      if (path.startsWith('/api/v2/teacher/lessons') || path === '/api/v2/teacher/statistics') return modules.teacher(request, response, next);
      if (path.startsWith('/api/v2/teacher/courses')) return modules.courses(request, response, next);
      if (path === '/api/v2/me/enrollment' || (request.method === 'GET' && (path === '/api/v2/courses' || path === '/api/v2/me/course'))) {
        return modules.enrollment(request, response, next);
      }
      next();
    });
  }

  if (!writesEnabled) {
    app.use('/api/v2', (request, response, next) => {
      if (request.method === 'GET' || request.method === 'HEAD') return next();
      response.status(503).json({
        code: 'FEATURE_DISABLED',
        message: 'Зміни тимчасово вимкнені до завершення міграції даних.',
        requestId: crypto.randomUUID(),
      });
    });
  }

  app.use(createApp({ database: readDatabase, botToken }));
  return app;
};
