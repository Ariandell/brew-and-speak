import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createProductionApp } from './createProductionApp.js';
import { createReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createWriteDatabase } from './infrastructure/db/writeSql.js';
import { applySandboxMigrationPlan } from './infrastructure/db/sandboxMigrationPlan.js';

const token = 'production-composition-test-token';
const signed = (id: number, firstName: string) => {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - 5),
    user: JSON.stringify({ id, first_name: firstName, username: firstName.toLowerCase() }) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return { 'X-Telegram-Init-Data': params.toString() };
};

test('production composition provisions verified students and exposes canonical writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'english-coffee-production-'));
  const path = join(root, 'database.sqlite');
  const url = `file:${path}`;
  const writeDatabase = createWriteDatabase({ url });
  await writeDatabase.batch([
    `CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id TEXT UNIQUE, name TEXT, username TEXT, role TEXT DEFAULT 'student', is_blocked INTEGER DEFAULT 0, enrolled_course_id INTEGER)`,
    `CREATE TABLE levels (id INTEGER PRIMARY KEY, title TEXT, description TEXT, "order" INTEGER)`,
    `CREATE TABLE lessons (id INTEGER PRIMARY KEY, level_id INTEGER, title TEXT, "order" INTEGER)`,
    `CREATE TABLE lesson_blocks (id INTEGER PRIMARY KEY, lesson_id INTEGER, type TEXT, content TEXT, "order" INTEGER)`,
    `CREATE TABLE user_progress (id INTEGER PRIMARY KEY, user_id INTEGER, lesson_id INTEGER, status TEXT, homework_status TEXT, unlocks_at TEXT, completed_at TEXT, score INTEGER, time_spent INTEGER)`,
    `CREATE TABLE homework_submissions (id INTEGER PRIMARY KEY, lesson_id INTEGER, user_id INTEGER, text TEXT, file_url TEXT, file_name TEXT, submitted_at TEXT, updated_at TEXT, grade INTEGER, feedback TEXT, status TEXT)`,
    `CREATE TABLE flashcards (id INTEGER PRIMARY KEY, lesson_id INTEGER, word TEXT, translation TEXT, example_phrase TEXT)`,
    `CREATE TABLE user_flashcard_progress (user_id TEXT, flashcard_id INTEGER, times_shown INTEGER, times_correct INTEGER, times_wrong INTEGER, ease_factor REAL, interval_days INTEGER, next_review_at TEXT, last_reviewed_at TEXT)`,
    `CREATE TABLE app_assets (id TEXT PRIMARY KEY, mime_type TEXT, data TEXT)`,
    { sql: `INSERT INTO users (telegram_id,name,username,role,is_blocked)
      VALUES ('900','Teacher','teacher','teacher',0)`, args: [] },
    { sql: `INSERT INTO users (telegram_id,name,username,role,is_blocked)
      VALUES ('777','Legacy Student','legacy_student','student',0)`, args: [] },
    { sql: `INSERT INTO levels (id,title,description,"order") VALUES (2,'A1','First course',1)`, args: [] },
    { sql: `INSERT INTO lessons (id,level_id,title,"order") VALUES (10,2,'Welcome',1)`, args: [] },
    { sql: `INSERT INTO homework_submissions
      (id,user_id,lesson_id,text,submitted_at,status)
      VALUES (99,'demo-user',10,'Orphaned demo answer','2026-01-01T00:00:00.000Z','pending')`, args: [] },
    { sql: `INSERT INTO homework_submissions
      (id,user_id,lesson_id,text,submitted_at,status,grade)
      VALUES (98,2,10,'Legacy graded answer','2026-01-02T00:00:00.000Z','graded',95)`, args: [] },
  ]);
  await applySandboxMigrationPlan(writeDatabase);
  const readDatabase = createReadOnlyDatabase({ url });
  const server = createProductionApp({ readDatabase, writeDatabase, databaseUrl: url, botToken: token, writesEnabled: true }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    const headers = signed(42, 'NewStudent');
    const me = await fetch(`${base}/api/v2/me`, { headers });
    assert.equal(me.status, 200);
    const meBody = await me.json() as { role: string; userId: number };
    assert.equal(meBody.role, 'student');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await writeDatabase.execute({ sql: `INSERT INTO user_progress
      (id,user_id,lesson_id,status,completed_at) VALUES (1,?,10,'completed',?)`, args: [meBody.userId, yesterday] });
    const streak = await fetch(`${base}/api/v2/me/streak`, { headers });
    assert.equal(streak.status, 200);
    assert.equal((await streak.json()).streakDays, 1);
    const choose = await fetch(`${base}/api/v2/me/enrollment`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: 2 }),
    });
    assert.equal(choose.status, 200);
    assert.equal((await choose.json()).courseId, 2);
    const course = await fetch(`${base}/api/v2/me/course`, { headers });
    assert.equal(course.status, 200);
    assert.equal((await course.json()).course.courseId, 2);

    const teacherHeaders = signed(900, 'Teacher');
    const homework = await fetch(`${base}/api/v2/teacher/homework`, { headers: teacherHeaders });
    assert.equal(homework.status, 200);
    const homeworkBody = await homework.json() as { items: Array<{ grade: number | null }> };
    assert.equal(homeworkBody.items.length, 1);
    assert.equal(homeworkBody.items[0]?.grade, 10);
    const createdLesson = await fetch(`${base}/api/v2/teacher/courses/2/lessons`, {
      method: 'POST', headers: { ...teacherHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Production lesson', order: 2 }),
    });
    assert.equal(createdLesson.status, 201);
    const lessonId = Number((await createdLesson.json()).lessonId);
    assert.ok(lessonId >= 1000000);
    const saved = await fetch(`${base}/api/v2/teacher/lessons/${lessonId}/blocks`, {
      method: 'PUT', headers: { ...teacherHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 0,
        blocks: [{ id: 1001, order: 0, type: 'text', html: '<p>Safe draft</p>' }] }),
    });
    assert.equal(saved.status, 200);
    const renamed = await fetch(`${base}/api/v2/teacher/lessons/${lessonId}`, {
      method: 'PATCH', headers: { ...teacherHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Renamed production lesson' }),
    });
    assert.equal(renamed.status, 200);
    assert.equal((await renamed.json()).title, 'Renamed production lesson');
    const pathResponse = await fetch(`${base}/api/v2/me/course/path`, { headers });
    assert.equal(pathResponse.status, 200);
    assert.ok((await pathResponse.json()).items.some((item: { lessonId: number }) => item.lessonId === lessonId));
    const removed = await fetch(`${base}/api/v2/teacher/lessons/${lessonId}`, {
      method: 'DELETE', headers: teacherHeaders,
    });
    assert.equal(removed.status, 204);
    const leaked = await fetch(`${base}/api/v2/sandbox/me/course`, { headers });
    assert.equal(leaked.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    writeDatabase.close();
    await unlink(path).catch(() => undefined);
  }
});

test('enabled writes fail closed when the additive migration was not applied', async () => {
  const root = await mkdtemp(join(tmpdir(), 'english-coffee-unprepared-'));
  const path = join(root, 'database.sqlite');
  const url = `file:${path}`;
  const writeDatabase = createWriteDatabase({ url });
  const readDatabase = createReadOnlyDatabase({ url });
  const server = createProductionApp({ readDatabase, writeDatabase, databaseUrl: url, botToken: token, writesEnabled: true }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v2/courses`, { headers: signed(42, 'Student') });
    assert.equal(response.status, 503);
    const tables = await writeDatabase.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'v3_%'");
    assert.equal(tables.rows.length, 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    writeDatabase.close();
    await unlink(path).catch(() => undefined);
  }
});

test('health remains available when the deployment database URL is malformed', async () => {
  const originalUrl = process.env.TURSO_DATABASE_URL;
  const originalWrites = process.env.V3_WRITES_ENABLED;
  process.env.TURSO_DATABASE_URL = 'not-a-database-url';
  process.env.V3_WRITES_ENABLED = 'false';
  const server = createProductionApp({ botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v2/health`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      status: 'degraded',
      service: 'english-with-coffee-api',
      apiVersion: 'v2',
      database: 'configuration-error',
      writes: 'disabled',
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    if (originalUrl === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = originalUrl;
    if (originalWrites === undefined) delete process.env.V3_WRITES_ENABLED;
    else process.env.V3_WRITES_ENABLED = originalWrites;
  }
});
