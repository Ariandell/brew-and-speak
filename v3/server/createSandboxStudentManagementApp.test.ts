import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { InStatement, ResultSet } from '@libsql/client';
import test from 'node:test';
import { createSandboxStudentManagementApp } from './createSandboxStudentManagementApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';

const token = 'sandbox-student-token';
const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0,
  lastInsertRowid: undefined, toJSON: () => ({}),
});
const signed = (): Record<string, string> => {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - 30), user: JSON.stringify({ id: 9, first_name: 'Teacher' }) });
  const checkString = [...params.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return { 'X-Telegram-Init-Data': params.toString() };
};

const readDatabase: ReadOnlyDatabase = {
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    const args = typeof statement === 'string' || !Array.isArray(statement.args) ? [] : statement.args;
    const requestedId = String(args[0] ?? '9');
    if (sql.includes("WHERE role = 'student'")) return result([{ id: 7, telegram_id: '7', name: 'Student', username: null, role: 'student', is_blocked: 0, enrolled_course_id: 2 }]);
    if (sql.includes('FROM users')) return result([requestedId === '7'
      ? { id: 7, telegram_id: '7', name: 'Student', username: null, role: 'student', is_blocked: 0, enrolled_course_id: 2 }
      : { id: 9, telegram_id: '9', name: 'Teacher', username: null, role: 'teacher', is_blocked: 0, enrolled_course_id: null }]);
    if (sql.includes('COUNT(*) AS count')) return result([{ count: 2 }]);
    if (sql.includes('AVG(score)')) return result([{ average_score: 8 }]);
    return result([]);
  },
};

test('sandbox student block control is teacher-only and separate from legacy user row', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-student-api-'));
  const path = join(root, 'sandbox.sqlite');
  const writeDatabase = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  const server = createSandboxStudentManagementApp({ readDatabase, writeDatabase, writeDatabaseUrl: `file:${path}`, botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const block = await fetch(`${baseUrl}/api/v2/sandbox/teacher/students/7/block`, { method: 'POST', headers: signed() });
    assert.equal(block.status, 200);
    assert.equal((await block.json()).isBlocked, true);
    const list = await fetch(`${baseUrl}/api/v2/sandbox/teacher/students`, { headers: signed() });
    assert.equal((await list.json()).items[0].isBlocked, true);
    const unblock = await fetch(`${baseUrl}/api/v2/sandbox/teacher/students/7/unblock`, { method: 'POST', headers: signed() });
    assert.equal(unblock.status, 200);
    assert.equal((await unblock.json()).isBlocked, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    writeDatabase.close();
    await unlink(path).catch(() => undefined);
  }
});
