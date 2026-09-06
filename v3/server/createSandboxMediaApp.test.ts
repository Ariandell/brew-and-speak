import { createHash, createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { InStatement, ResultSet } from '@libsql/client';
import test from 'node:test';
import { createSandboxMediaApp } from './createSandboxMediaApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';

const token = 'sandbox-media-token';
const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({ columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0, lastInsertRowid: undefined, toJSON: () => ({}) });
const headers = (userId = 9): Record<string, string> => {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - 30), user: JSON.stringify({ id: userId, first_name: userId === 9 ? 'Teacher' : 'Student' }) });
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return { 'X-Telegram-Init-Data': params.toString(), 'Content-Type': 'application/json' };
};
const readDatabase: ReadOnlyDatabase = {
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (!sql.includes('FROM users')) return result([]);
    const args = typeof statement === 'string' ? undefined : statement.args;
    const telegramId = String(Array.isArray(args) ? args[0] ?? '9' : '9');
    const id = Number(telegramId);
    return result([{ id, telegram_id: telegramId, name: id === 9 ? 'Teacher' : 'Student', username: null,
      role: id === 9 ? 'teacher' : 'student', is_blocked: 0, enrolled_course_id: id === 10 ? 2 : id === 11 ? 3 : null }]);
  },
};

test('sandbox media upload is teacher-only and idempotent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-media-api-'));
  const path = join(root, 'sandbox.sqlite');
  const writeDatabase = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  const server = createSandboxMediaApp({ readDatabase, writeDatabase, writeDatabaseUrl: `file:${path}`, botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v2/sandbox/teacher/assets`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ assetId: 'asset-1', mimeType: 'image/png', base64Data: 'aGVsbG8=' }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).bytes, 5);
    const conflict = await fetch(`http://127.0.0.1:${address.port}/api/v2/sandbox/teacher/assets`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ assetId: 'asset-1', mimeType: 'image/png', base64Data: 'd29ybGQ=' }),
    });
    assert.equal(conflict.status, 409);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    writeDatabase.close();
    await unlink(path).catch(() => undefined);
  }
});

test('chunked media API completes, resumes duplicates, protects ownership and aborts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-media-chunk-api-'));
  const path = join(root, 'sandbox.sqlite');
  const writeDatabase = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  const server = createSandboxMediaApp({ readDatabase, writeDatabase, writeDatabaseUrl: `file:${path}`, botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api/v2/sandbox/assets/uploads`;
    const data = Buffer.from('hello');
    const sha = (input: Buffer) => createHash('sha256').update(input).digest('hex');
    const post = (url: string, body: unknown, userId = 9, method = 'POST') => fetch(url,
      { method, headers: headers(userId), body: body === undefined ? undefined : JSON.stringify(body) });
    const plan = { uploadId: 'api-session', assetId: 'api-asset', mimeType: 'image/png', fileName: 'cup.png',
      totalBytes: data.length, sha256: sha(data), chunkSize: 2, totalChunks: 3 };
    assert.equal((await post(base, plan)).status, 201);
    assert.equal((await post(base, plan)).status, 201, 'session retry is idempotent');
    const first = { base64Data: data.subarray(0, 2).toString('base64'), sha256: sha(data.subarray(0, 2)) };
    assert.equal((await post(`${base}/api-session/chunks/1`, first, 9, 'PUT')).status, 409, 'out-of-order chunk');
    assert.equal((await post(`${base}/api-session/chunks/0`, first, 10, 'PUT')).status, 403, 'foreign session');
    assert.equal((await post(`${base}/api-session/chunks/0`, first, 9, 'PUT')).status, 200);
    assert.equal((await post(`${base}/api-session/chunks/0`, first, 9, 'PUT')).status, 200, 'duplicate chunk');
    assert.equal((await post(`${base}/api-session/finalize`, undefined)).status, 409, 'missing chunks');
    for (const index of [1, 2]) {
      const bytes = data.subarray(index * 2, Math.min(data.length, (index + 1) * 2));
      assert.equal((await post(`${base}/api-session/chunks/${index}`,
        { base64Data: bytes.toString('base64'), sha256: sha(bytes) }, 9, 'PUT')).status, 200);
    }
    const finalized = await post(`${base}/api-session/finalize`, undefined);
    assert.equal(finalized.status, 201);
    assert.equal((await finalized.json()).sha256, sha(data));

    const abortPlan = { ...plan, uploadId: 'abort-session', assetId: 'abort-asset' };
    assert.equal((await post(base, abortPlan)).status, 201);
    assert.equal((await post(`${base}/abort-session`, undefined, 10, 'DELETE')).status, 403);
    assert.equal((await post(`${base}/abort-session`, undefined, 9, 'DELETE')).status, 204);
    assert.equal((await post(`${base}/abort-session/finalize`, undefined)).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    writeDatabase.close();
    await unlink(path).catch(() => undefined);
  }
});

test('asset downloads require an owned homework, enrolled lesson, published broadcast or teacher role', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-media-read-api-'));
  const path = join(root, 'sandbox.sqlite');
  const writeDatabase = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  await writeDatabase.batch([
    'CREATE TABLE lessons (id INTEGER PRIMARY KEY, level_id INTEGER)',
    'CREATE TABLE photo_messages (id INTEGER PRIMARY KEY, image_url TEXT, scheduled_at TEXT)',
    'CREATE TABLE homework_submissions (id INTEGER PRIMARY KEY, user_id INTEGER, file_url TEXT)',
    { sql: 'INSERT INTO lessons (id, level_id) VALUES (1, 2)', args: [] },
  ]);
  const server = createSandboxMediaApp({ readDatabase, writeDatabase, writeDatabaseUrl: `file:${path}`, botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}/api/v2/sandbox`;
    const upload = async (assetId: string, userId: number) => {
      const response = await fetch(`${base}/${userId === 9 ? 'teacher' : 'me'}/assets`, {
        method: 'POST', headers: headers(userId),
        body: JSON.stringify({ assetId, mimeType: 'image/png', base64Data: Buffer.from(assetId).toString('base64') }),
      });
      assert.equal(response.status, 201);
    };
    await upload('lesson-asset', 9);
    await writeDatabase.execute({
      sql: `INSERT INTO v3_lesson_drafts (lesson_id,content_revision,blocks_json,updated_by,updated_at)
        VALUES (1,1,?,9,?)`,
      args: [JSON.stringify([{ id: 1, order: 0, type: 'photo', assetId: 'lesson-asset', alt: 'Cup' }]), new Date().toISOString()],
    });
    assert.equal((await fetch(`${base}/assets/lesson-asset`, { headers: headers(10) })).status, 200);
    assert.equal((await fetch(`${base}/assets/lesson-asset`, { headers: headers(11) })).status, 404);

    await upload('broadcast-now', 9);
    await upload('broadcast-future', 9);
    await writeDatabase.batch([
      { sql: `INSERT INTO v3_photo_messages VALUES ('now','broadcast-now','Now',?,?)`,
        args: [new Date(Date.now() - 60_000).toISOString(), new Date().toISOString()] },
      { sql: `INSERT INTO v3_photo_messages VALUES ('future','broadcast-future','Future',?,?)`,
        args: [new Date(Date.now() + 60_000).toISOString(), new Date().toISOString()] },
    ]);
    assert.equal((await fetch(`${base}/assets/broadcast-now`, { headers: headers(10) })).status, 200);
    assert.equal((await fetch(`${base}/assets/broadcast-future`, { headers: headers(10) })).status, 404);

    await upload('student-homework', 10);
    assert.equal((await fetch(`${base}/assets/student-homework`, { headers: headers(10) })).status, 200);
    assert.equal((await fetch(`${base}/assets/student-homework`, { headers: headers(11) })).status, 404);
    assert.equal((await fetch(`${base}/assets/student-homework`, { headers: headers(9) })).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    writeDatabase.close();
    await unlink(path).catch(() => undefined);
  }
});
