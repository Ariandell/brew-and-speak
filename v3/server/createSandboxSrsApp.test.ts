import { createHmac } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import type { InStatement, ResultSet } from '@libsql/client';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxSrsApp } from './createSandboxSrsApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxSrsSchema } from './modules/flashcards/sandboxSrsRepository.js';

const token = 'sandbox-srs-test-token';
const signedInitData = (): string => {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000) - 30), user: JSON.stringify({ id: 42, first_name: 'Student' }) });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secretKey).update(checkString).digest('hex'));
  return params.toString();
};
const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({ columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0, lastInsertRowid: undefined, toJSON: () => ({}) });
const readDatabase: ReadOnlyDatabase = {
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (sql.includes('FROM users')) return result([{ id: 7, telegram_id: '42', name: 'Student', username: null, role: 'student', is_blocked: 0, enrolled_course_id: 2 }]);
    if (sql.includes('FROM flashcards')) return result([{ id: 500, lesson_id: 10, word: 'brew', translation: 'заварювати', example_phrase: null, lesson_title: 'Coffee', times_shown: 0, times_correct: 0, times_wrong: 0, ease_factor: 2.5, interval_days: 0, next_review_at: null }]);
    if (sql.includes('FROM user_progress')) return result([{ lesson_id: 10, status: 'completed' }]);
    if (sql.includes('FROM homework_submissions') || sql.includes('FROM lesson_blocks')) return result([]);
    if (sql.includes('FROM lessons WHERE level_id')) return result([{ id: 10, title: 'Coffee', lesson_order: 1 }]);
    return result([]);
  },
};

test('sandbox SRS API scopes card access and honors idempotency', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-srs-api-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  await initializeSandboxSrsSchema(database);
  const server = createSandboxSrsApp({ readDatabase, writeDatabase: database, writeDatabaseUrl: `file:${path}`, botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const url = `http://127.0.0.1:${address.port}/api/v2/sandbox/me/flashcards/500/review`;
    const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
    const first = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ correct: true, idempotencyKey: 'srs-1' }) });
    assert.equal(first.status, 201);
    const firstBody = await first.json();
    assert.equal(firstBody.intervalDays, 1);
    const dictionary = await fetch(`${baseUrl(address.port)}/api/v2/sandbox/me/dictionary`, { headers });
    assert.equal(dictionary.status, 200);
    assert.equal((await dictionary.json()).items[0].intervalDays, 1);
    const retry = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ correct: false, idempotencyKey: 'srs-1' }) });
    assert.equal(retry.status, 201);
    assert.deepEqual(await retry.json(), firstBody);
    const unavailable = await fetch(`${baseUrl(address.port)}/api/v2/sandbox/me/flashcards/999/review`, { method: 'POST', headers, body: JSON.stringify({ correct: true, idempotencyKey: 'srs-2' }) });
    assert.equal(unavailable.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    database.close();
    await unlink(path).catch(() => undefined);
  }
});

const baseUrl = (port: number): string => `http://127.0.0.1:${port}`;
