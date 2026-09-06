import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { InStatement, ResultSet } from '@libsql/client';
import test from 'node:test';
import { createSandboxEnrollmentApp } from './createSandboxEnrollmentApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';

const token = 'sandbox-enrollment-token';
const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0,
  lastInsertRowid: undefined, toJSON: () => ({}),
});

const headers = (): Record<string, string> => {
  const authDate = Math.floor(Date.now() / 1000) - 30;
  const params = new URLSearchParams({ auth_date: String(authDate), user: JSON.stringify({ id: 42, first_name: 'Student' }) });
  const checkString = [...params.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return { 'X-Telegram-Init-Data': params.toString() };
};

const readDatabase: ReadOnlyDatabase = {
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (sql.includes('FROM users')) return result([{ id: 7, telegram_id: '42', name: 'Student', username: null, role: 'student', is_blocked: 0, enrolled_course_id: 2 }]);
    if (sql.includes('FROM levels')) return result([
      { id: 2, title: 'English A', description: 'A', course_order: 1, lesson_count: 1 },
      { id: 3, title: 'English B', description: 'B', course_order: 2, lesson_count: 1 },
    ]);
    if (sql.includes('SELECT lesson_id, status')) return result([]);
    if (sql.includes('SELECT lesson_id, grade')) return result([]);
    if (sql.includes('SELECT DISTINCT lesson_id')) return result([]);
    if (sql.includes('FROM lessons WHERE level_id')) return result([{ id: 30, title: 'Lesson', lesson_order: 1 }]);
    return result([]);
  },
};

test('sandbox enrollment is scoped to student and changes the effective course without legacy writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-enrollment-'));
  const path = join(root, 'sandbox.sqlite');
  const writeDatabase = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  const server = createSandboxEnrollmentApp({ readDatabase, writeDatabase, writeDatabaseUrl: `file:${path}`, botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const list = await fetch(`${baseUrl}/api/v2/sandbox/courses`, { headers: headers() });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).items.length, 2);

    const choose = await fetch(`${baseUrl}/api/v2/sandbox/me/enrollment`, {
      method: 'POST', headers: { ...headers(), 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId: 3 }),
    });
    assert.equal(choose.status, 200);
    assert.equal((await choose.json()).courseId, 3);

    const course = await fetch(`${baseUrl}/api/v2/sandbox/me/course`, { headers: headers() });
    assert.equal(course.status, 200);
    assert.equal((await course.json()).course.courseId, 3);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    writeDatabase.close();
    await unlink(path).catch(() => undefined);
  }
});
