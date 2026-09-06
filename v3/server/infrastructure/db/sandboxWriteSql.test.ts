import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase } from './sandboxWriteSql.js';

test('sandbox writer is explicit and can atomically write a local SQLite file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-write-'));
  const path = join(root, 'sandbox.sqlite');
  const url = `file:${path}`;
  let database: ReturnType<typeof createSandboxWriteDatabase> | undefined;
  try {
    database = createSandboxWriteDatabase({ url, mode: 'sandbox' });
    await database.batch([
      'CREATE TABLE attempts (id TEXT PRIMARY KEY, score INTEGER NOT NULL)',
      { sql: 'INSERT INTO attempts (id, score) VALUES (?, ?)', args: ['attempt-1', 8] },
    ]);
    const result = await database.execute('SELECT id, score FROM attempts');
    assert.deepEqual(result.rows, [{ id: 'attempt-1', score: 8 }]);
  } finally {
    database?.close();
    await unlink(path).catch(() => undefined);
  }
});

test('sandbox writer rejects remote database URLs before connecting', () => {
  assert.throws(
    () => createSandboxWriteDatabase({ url: 'libsql://production.example', mode: 'sandbox' }),
    /file: SQLite URLs only/,
  );
});
