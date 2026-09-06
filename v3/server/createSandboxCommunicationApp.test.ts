import { createHmac } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import type { InStatement, ResultSet } from '@libsql/client';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxCommunicationApp } from './createSandboxCommunicationApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxCommunicationSchema } from './modules/communication/sandboxCommunicationRepository.js';

const token = 'sandbox-communication-test-token';
const signedInitData = (): string => {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - 30), user: JSON.stringify({ id: 42, first_name: 'User' }) });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secretKey).update(checkString).digest('hex'));
  return params.toString();
};
const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({ columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0, lastInsertRowid: undefined, toJSON: () => ({}) });
const readDatabase = (role: 'student' | 'teacher'): ReadOnlyDatabase => ({
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (sql.includes('WHERE telegram_id')) return result([{
      id: role === 'student' ? 7 : 9, telegram_id: '42', name: 'User', username: null, role,
      is_blocked: 0, enrolled_course_id: 2,
    }]);
    if (sql.includes('WHERE id = ?')) return result([{ id: 7, telegram_id: 'student-7', name: 'Student', username: null, role: 'student', is_blocked: 0, enrolled_course_id: 2 }]);
    if (sql.includes("role IN ('teacher', 'admin')")) return result([{ id: 9, telegram_id: 'teacher-9', name: 'Teacher', username: null, role: 'teacher', is_blocked: 0, enrolled_course_id: null }]);
    if (sql.includes("WHERE role = 'student'")) return result([{ id: 7, telegram_id: 'student-7', name: 'Student', username: null, role: 'student', is_blocked: 0, enrolled_course_id: 2 }]);
    return result([]);
  },
});

const startServer = (role: 'student' | 'teacher', database: ReturnType<typeof createSandboxWriteDatabase>) => {
  const server = createSandboxCommunicationApp({ readDatabase: readDatabase(role), writeDatabase: database, writeDatabaseUrl: 'file:sandbox.sqlite', botToken: token }).listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

test('sandbox communication API scopes chat and scheduled photo commands', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-communication-api-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  await initializeSandboxCommunicationSchema(database);
  const student = startServer('student', database);
  const teacher = startServer('teacher', database);
  const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
  try {
    const send = await fetch(`${student.baseUrl}/api/v2/sandbox/me/chat/messages`, {
      method: 'POST', headers, body: JSON.stringify({ messageId: 'message-api-1', body: '<b>Hello</b>' }),
    });
    assert.equal(send.status, 201);
    const conversations = await fetch(`${teacher.baseUrl}/api/v2/sandbox/teacher/chat/conversations`, { headers });
    assert.equal(conversations.status, 200);
    assert.equal((await conversations.json()).items[0].studentUserId, 7);
    const teacherReply = await fetch(`${teacher.baseUrl}/api/v2/sandbox/teacher/chat/conversations/7/messages`, {
      method: 'POST', headers, body: JSON.stringify({ messageId: 'message-api-2', body: 'Hi' }),
    });
    assert.equal(teacherReply.status, 201);
    const messages = await fetch(`${student.baseUrl}/api/v2/sandbox/me/chat`, { headers });
    assert.equal((await messages.json()).items.length, 2);

    const schedule = await fetch(`${teacher.baseUrl}/api/v2/sandbox/teacher/photo-messages`, {
      method: 'POST', headers, body: JSON.stringify({ photoId: 'photo-api-1', assetId: 'asset-1', caption: 'Morning', scheduledAt: '2026-01-01T00:00:00.000Z' }),
    });
    assert.equal(schedule.status, 201);
    const photos = await fetch(`${student.baseUrl}/api/v2/sandbox/me/photo-messages`, { headers });
    assert.equal((await photos.json()).items[0].photoId, 'photo-api-1');
    const viewed = await fetch(`${student.baseUrl}/api/v2/sandbox/me/photo-messages/photo-api-1/viewed`, { method: 'POST', headers, body: '{}' });
    assert.equal(viewed.status, 204);
    const deleted = await fetch(`${teacher.baseUrl}/api/v2/sandbox/teacher/photo-messages/photo-api-1`, { method: 'DELETE', headers });
    assert.equal(deleted.status, 204);
  } finally {
    await Promise.all([
      new Promise<void>((resolve, reject) => student.server.close((error) => error ? reject(error) : resolve())),
      new Promise<void>((resolve, reject) => teacher.server.close((error) => error ? reject(error) : resolve())),
    ]);
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
