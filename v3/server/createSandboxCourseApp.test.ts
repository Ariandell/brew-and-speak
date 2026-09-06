import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { InStatement, ResultSet } from '@libsql/client';
import test from 'node:test';
import { createSandboxCourseApp } from './createSandboxCourseApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';

const token = 'sandbox-course-token';
const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0,
  lastInsertRowid: undefined, toJSON: () => ({}),
});
const signed = (role: 'teacher' | 'student'): Record<string, string> => {
  const authDate = Math.floor(Date.now() / 1000) - 30;
  const params = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify({ id: role === 'teacher' ? 9 : 7, first_name: role }) });
  const checkString = [...params.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return { 'X-Telegram-Init-Data': params.toString() };
};

const readDatabase: ReadOnlyDatabase = {
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (sql.includes('FROM users')) {
      const args = typeof statement === 'string' || !Array.isArray(statement.args) ? [] : statement.args;
      const telegramId = String(args[0] ?? '9');
      return result([telegramId === '7'
        ? { id: 7, telegram_id: '7', name: 'Student', username: null, role: 'student', is_blocked: 0, enrolled_course_id: 2 }
        : { id: 9, telegram_id: '9', name: 'Teacher', username: null, role: 'teacher', is_blocked: 0, enrolled_course_id: null }]);
    }
    if (sql.includes('FROM levels')) return result([{ id: 2, title: 'English', description: 'Legacy', course_order: 1, lesson_count: 2 }]);
    return result([]);
  },
};

test('sandbox teacher course management is isolated from legacy courses', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-course-api-'));
  const path = join(root, 'sandbox.sqlite');
  const writeDatabase = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  const server = createSandboxCourseApp({ readDatabase, writeDatabase, writeDatabaseUrl: `file:${path}`, botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const initial = await fetch(`${baseUrl}/api/v2/sandbox/teacher/courses`, { headers: signed('teacher') });
    assert.equal(initial.status, 200);
    assert.equal((await initial.json()).items.length, 1);

    const created = await fetch(`${baseUrl}/api/v2/sandbox/teacher/courses`, {
      method: 'POST', headers: { ...signed('teacher'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Summer', description: 'Season', order: 2 }),
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json();
    assert.equal(createdBody.title, 'Summer');
    assert.ok(createdBody.courseId >= 100000);

    const createdLesson = await fetch(`${baseUrl}/api/v2/sandbox/teacher/courses/2/lessons`, {
      method: 'POST', headers: { ...signed('teacher'), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'V3 lesson', order: 3 }),
    });
    assert.equal(createdLesson.status, 201);
    const lessonBody = await createdLesson.json();
    assert.ok(lessonBody.lessonId >= 1000000);
    const lessons = await fetch(`${baseUrl}/api/v2/sandbox/teacher/courses/2/lessons`, { headers: signed('teacher') });
    assert.equal(lessons.status, 200);
    assert.deepEqual((await lessons.json()).items.map((lesson: { lessonId: number }) => lesson.lessonId), [lessonBody.lessonId]);

    const updated = await fetch(`${baseUrl}/api/v2/sandbox/teacher/courses/${createdBody.courseId}`, {
      method: 'PATCH', headers: { ...signed('teacher'), 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Summer updated' }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).title, 'Summer updated');

    const studentDenied = await fetch(`${baseUrl}/api/v2/sandbox/teacher/courses`, { headers: signed('student') });
    assert.equal(studentDenied.status, 403);

    const deleted = await fetch(`${baseUrl}/api/v2/sandbox/teacher/courses/${createdBody.courseId}`, { method: 'DELETE', headers: signed('teacher') });
    assert.equal(deleted.status, 204);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    writeDatabase.close();
    await unlink(path).catch(() => undefined);
  }
});
