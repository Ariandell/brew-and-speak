import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase, type SandboxWriteDatabase } from './sandboxWriteSql.js';
import { MigrationChecksumConflictError, runSandboxMigrations } from './sandboxMigrations.js';

const withDatabase = async (run: (database: SandboxWriteDatabase) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-migrations-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try { await run(database); }
  finally { database.close(); await unlink(path).catch(() => undefined); }
};

test('sandbox migrations apply once and are idempotent', async () => {
  await withDatabase(async (database) => {
    const migrations = [{
      id: 'v3-test-001',
      statements: ['CREATE TABLE v3_test_values (id TEXT PRIMARY KEY)'] as const,
    }];
    assert.deepEqual(await runSandboxMigrations(database, migrations), ['v3-test-001']);
    assert.deepEqual(await runSandboxMigrations(database, migrations), []);
    const rows = await database.execute('SELECT id FROM v3_schema_migrations');
    assert.equal(rows.rows.length, 1);
  });
});

test('changed migration content stops instead of silently mutating schema', async () => {
  await withDatabase(async (database) => {
    await runSandboxMigrations(database, [{ id: 'v3-test-002', statements: ['CREATE TABLE v3_a (id TEXT)'] }]);
    await assert.rejects(
      () => runSandboxMigrations(database, [{ id: 'v3-test-002', statements: ['CREATE TABLE v3_b (id TEXT)'] }]),
      (error: unknown) => error instanceof MigrationChecksumConflictError,
    );
  });
});
