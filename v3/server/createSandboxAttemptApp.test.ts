import { createHmac } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import type { InStatement, ResultSet } from '@libsql/client';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxAttemptApp } from './createSandboxAttemptApp.js';
import { initializeSandboxAttemptSchema } from './modules/progress/sandboxAttemptRepository.js';
import { initializeSandboxLessonDraftSchema, saveSandboxLessonDraft } from './modules/teacher/sandboxLessonDraftRepository.js';
import { createSandboxWriteDatabase, type SandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxLesson } from './modules/lessons/sandboxLessonRepository.js';

const token = 'sandbox-api-test-token';
const signedInitData = (): string => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000) - 30),
    user: JSON.stringify({ id: 42, first_name: 'Student', username: 'student' }),
  });
  const checkString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secretKey).update(checkString).digest('hex'));
  return params.toString();
};

const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0,
  lastInsertRowid: undefined, toJSON: () => ({}),
});

const fakeReadDatabase = (role: 'student' | 'teacher' = 'student'): ReadOnlyDatabase => ({
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (sql.includes('FROM users')) return result([{
      id: 7, telegram_id: '42', name: 'Student', username: 'student', role,
      is_blocked: 0, enrolled_course_id: 2,
    }]);
    if (sql.includes('FROM lessons WHERE id')) return result([{ id: 10, level_id: 2, title: 'Coffee', lesson_order: 1 }]);
    if (sql.includes('FROM lesson_blocks WHERE lesson_id')) return result([{
      id: 100, type: 'quiz', content: JSON.stringify({ question: 'Q', options: [
        { label: 'A', isCorrect: true }, { label: 'B', isCorrect: false },
      ] }), block_order: 0,
    }]);
    if (sql.includes('SELECT DISTINCT lesson_id')) return result([]);
    if (sql.includes('FROM user_progress') || sql.includes('FROM homework_submissions')) return result([]);
    if (sql.includes('FROM lessons WHERE level_id')) return result([{ id: 10, title: 'Coffee', lesson_order: 1 }]);
    return result([]);
  },
});

const withApp = async (run: (baseUrl: string, database: SandboxWriteDatabase) => Promise<void>, role: 'student' | 'teacher' = 'student') => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-sandbox-api-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  await initializeSandboxAttemptSchema(database);
  const server = createSandboxAttemptApp({
    readDatabase: fakeReadDatabase(role),
    writeDatabase: database,
    writeDatabaseUrl: `file:${path}`,
    botToken: token,
  }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    await run(`http://127.0.0.1:${address.port}`, database);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
    await unlink(path).catch(() => undefined);
  }
};

test('sandbox API derives identity and score on the server', async () => {
  await withApp(async (baseUrl) => {
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
    const start = await fetch(`${baseUrl}/api/v2/sandbox/attempts`, {
      method: 'POST', headers,
      body: JSON.stringify({ attemptId: 'api-attempt-1', lessonId: 10, userId: 999, score: 10 }),
    });
    assert.equal(start.status, 201);
    const started = await start.json();
    assert.equal(started.userId, 7);
    assert.equal(started.total, 1);

    const forged = await fetch(`${baseUrl}/api/v2/sandbox/attempts/api-attempt-1/answers`, {
      method: 'POST', headers, body: JSON.stringify({ blockId: '100', outcome: 'correct' }),
    });
    assert.equal(forged.status, 400);
    const answer = await fetch(`${baseUrl}/api/v2/sandbox/attempts/api-attempt-1/answers`, {
      method: 'POST', headers, body: JSON.stringify({ blockId: '100', answer: 'B' }),
    });
    assert.equal(answer.status, 201);
    const duplicate = await fetch(`${baseUrl}/api/v2/sandbox/attempts/api-attempt-1/answers`, {
      method: 'POST', headers, body: JSON.stringify({ blockId: '100', answer: 'A' }),
    });
    assert.equal(duplicate.status, 200);
    assert.equal((await duplicate.json()).reason, 'duplicate');

    const finish = await fetch(`${baseUrl}/api/v2/sandbox/attempts/api-attempt-1/finish`, {
      method: 'POST', headers, body: '{}',
    });
    assert.equal(finish.status, 200);
    const finished = await finish.json();
    assert.equal(finished.score, 0);
    assert.equal(finished.wrong, 1);
    assert.equal(finished.skipped, 0);
    const path = await fetch(`${baseUrl}/api/v2/sandbox/me/course/path`, { headers });
    assert.equal(path.status, 200);
    assert.equal((await path.json()).items[0].status, 'completed');
    const retake = await fetch(`${baseUrl}/api/v2/sandbox/attempts`, {
      method: 'POST', headers, body: JSON.stringify({ attemptId: 'too-soon', lessonId: 10 }),
    });
    assert.equal(retake.status, 409);
    assert.equal((await retake.json()).code, 'COOLDOWN');
  });
});

test('new attempts use teacher draft and answers retain the frozen draft after edits', async () => {
  await withApp(async (baseUrl, database) => {
    await initializeSandboxLessonDraftSchema(database);
    const save = (expectedRevision: number, answer: boolean) => saveSandboxLessonDraft(database, {
      lessonId: 10, expectedRevision, updatedBy: 9, updatedAt: new Date().toISOString(),
      blocks: [{ id: 200, order: 0, type: 'true_false', statement: 'Draft question', correct: answer }],
    });
    await save(0, true);
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
    const start = await fetch(`${baseUrl}/api/v2/sandbox/attempts`, {
      method: 'POST', headers, body: JSON.stringify({ attemptId: 'draft-attempt', lessonId: 10 }),
    });
    assert.equal(start.status, 201);
    await save(1, false);
    const answer = await fetch(`${baseUrl}/api/v2/sandbox/attempts/draft-attempt/answers`, {
      method: 'POST', headers, body: JSON.stringify({ blockId: '200', answer: true }),
    });
    assert.equal(answer.status, 201);
    const finish = await fetch(`${baseUrl}/api/v2/sandbox/attempts/draft-attempt/finish`, { method: 'POST', headers });
    assert.equal(finish.status, 200);
    assert.equal((await finish.json()).score, 10);
  });
});

test('sandbox API requires Telegram auth and denies teacher attempts', async () => {
  await withApp(async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/api/v2/sandbox/attempts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    assert.equal(missing.status, 401);
  });
  await withApp(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v2/sandbox/attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() },
      body: JSON.stringify({ attemptId: 'teacher-attempt', lessonId: 10 }),
    });
    assert.equal(response.status, 403);
  }, 'teacher');
});

test('new V3 lesson appears in course path and supplies the student GET and attempt snapshot', async () => {
  await withApp(async (baseUrl, database) => {
    const lesson = await createSandboxLesson(database, { courseId: 2, title: 'Effective V3 lesson', order: 0 });
    await saveSandboxLessonDraft(database, {
      lessonId: lesson.id, expectedRevision: 0, updatedBy: 9, updatedAt: new Date().toISOString(),
      blocks: [{ id: 301, order: 0, type: 'true_false', statement: 'V3?', correct: true }],
    });
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
    const path = await fetch(`${baseUrl}/api/v2/sandbox/me/course/path`, { headers });
    assert.equal(path.status, 200);
    const pathBody = await path.json();
    assert.equal(pathBody.items[0].lessonId, lesson.id);
    assert.equal(pathBody.items[0].status, 'available');
    assert.equal(pathBody.items[0].score, null);

    const loaded = await fetch(`${baseUrl}/api/v2/sandbox/lessons/${lesson.id}`, { headers });
    assert.equal(loaded.status, 200);
    const loadedBody = await loaded.json();
    assert.equal(loadedBody.title, 'Effective V3 lesson');
    assert.equal(loadedBody.contentRevision, 'draft-1');
    assert.equal(loadedBody.blocks[0].id, 301);

    const started = await fetch(`${baseUrl}/api/v2/sandbox/attempts`, {
      method: 'POST', headers, body: JSON.stringify({ attemptId: 'new-v3-lesson', lessonId: lesson.id }),
    });
    assert.equal(started.status, 201);
    assert.equal((await started.json()).contentRevision, 'draft-1');
  });
});
