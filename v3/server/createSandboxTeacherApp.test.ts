import { createHmac } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import type { InStatement, ResultSet } from '@libsql/client';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxTeacherApp } from './createSandboxTeacherApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxLessonDraftSchema } from './modules/teacher/sandboxLessonDraftRepository.js';
import { createSandboxLesson, initializeSandboxLessonSchema } from './modules/lessons/sandboxLessonRepository.js';
import { initializeSandboxAttemptSchema } from './modules/progress/sandboxAttemptRepository.js';
import { initializeSandboxHomeworkSchema } from './modules/homework/sandboxHomeworkRepository.js';

const token = 'sandbox-teacher-test-token';
const signedInitData = (): string => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000) - 30),
    user: JSON.stringify({ id: 42, first_name: 'Teacher', username: 'teacher' }),
  });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secretKey).update(checkString).digest('hex'));
  return params.toString();
};

const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0,
  lastInsertRowid: undefined, toJSON: () => ({}),
});

const fakeReadDatabase = (role: 'student' | 'teacher'): ReadOnlyDatabase => ({
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (sql.includes('FROM users')) return result([{
      id: 9, telegram_id: '42', name: 'Teacher', username: 'teacher', role,
      is_blocked: 0, enrolled_course_id: 2,
    }]);
    if (sql.includes('FROM lessons WHERE id')) {
      const args = typeof statement === 'string' || !Array.isArray(statement.args) ? [] : statement.args;
      return Number(args[0]) === 10
        ? result([{ id: 10, level_id: 2, title: 'Coffee', lesson_order: 1 }])
        : result([]);
    }
    if (sql.includes('FROM lesson_blocks WHERE lesson_id')) return result([{
      id: 100, type: 'text', content: JSON.stringify({ body: '<p>Legacy</p>' }), block_order: 0,
    }]);
    return result([]);
  },
});

const withApp = async (role: 'student' | 'teacher', run: (baseUrl: string, database: ReturnType<typeof createSandboxWriteDatabase>) => Promise<void>) => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-teacher-api-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  await database.batch([
    'CREATE TABLE user_progress (id INTEGER PRIMARY KEY, lesson_id INTEGER)',
    'CREATE TABLE homework_submissions (id INTEGER PRIMARY KEY, lesson_id INTEGER)',
    'CREATE TABLE flashcards (id INTEGER PRIMARY KEY, lesson_id INTEGER)',
  ]);
  await Promise.all([
    initializeSandboxLessonDraftSchema(database), initializeSandboxLessonSchema(database),
    initializeSandboxAttemptSchema(database), initializeSandboxHomeworkSchema(database),
  ]);
  const server = createSandboxTeacherApp({
    readDatabase: fakeReadDatabase(role), writeDatabase: database, writeDatabaseUrl: `file:${path}`, botToken: token,
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

test('sandbox teacher editor saves typed draft and rejects stale revision', async () => {
  await withApp('teacher', async (baseUrl) => {
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
    const legacy = await fetch(`${baseUrl}/api/v2/sandbox/teacher/lessons/10`, { headers });
    assert.equal(legacy.status, 200);
    assert.equal((await legacy.json()).contentRevision, 'legacy-10');

    const save = await fetch(`${baseUrl}/api/v2/sandbox/teacher/lessons/10/blocks`, {
      method: 'PUT', headers,
      body: JSON.stringify({ expectedRevision: null, blocks: [
        { id: 1, order: 0, type: 'text', html: '<p>New <script>x</script>text</p>' },
      ] }),
    });
    assert.equal(save.status, 200);
    const saved = await save.json();
    assert.equal(saved.contentRevision, 'draft-1');
    assert.equal(saved.blocks[0].html, '<p>New text</p>');

    const conflict = await fetch(`${baseUrl}/api/v2/sandbox/teacher/lessons/10/blocks`, {
      method: 'PUT', headers,
      body: JSON.stringify({ expectedRevision: 0, blocks: [{ id: 1, order: 0, type: 'text', html: '<p>Conflict</p>' }] }),
    });
    assert.equal(conflict.status, 409);
  });
});

test('student cannot access sandbox teacher editor', async () => {
  await withApp('student', async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v2/sandbox/teacher/lessons/10`, {
      headers: { 'X-Telegram-Init-Data': signedInitData() },
    });
    assert.equal(response.status, 403);
  });
});

test('teacher can update and safely delete a new V3 lesson through canonical CRUD routes', async () => {
  await withApp('teacher', async (baseUrl, database) => {
    const lesson = await createSandboxLesson(database, { courseId: 2, title: 'New lesson', order: 2 });
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
    const update = await fetch(`${baseUrl}/api/v2/sandbox/teacher/lessons/${lesson.id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ title: 'Updated lesson', order: 3 }),
    });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).title, 'Updated lesson');
    await database.execute({ sql: 'INSERT INTO flashcards VALUES (1, ?)', args: [lesson.id] });
    const refused = await fetch(`${baseUrl}/api/v2/sandbox/teacher/lessons/${lesson.id}`, {
      method: 'DELETE', headers,
    });
    assert.equal(refused.status, 409);
    await database.execute('DELETE FROM flashcards');
    const deleted = await fetch(`${baseUrl}/api/v2/sandbox/teacher/lessons/${lesson.id}`, {
      method: 'DELETE', headers,
    });
    assert.equal(deleted.status, 204);
    const missing = await fetch(`${baseUrl}/api/v2/sandbox/teacher/lessons/${lesson.id}`, { headers });
    assert.equal(missing.status, 404);
  });
});
