import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase } from './sandboxWriteSql.js';
import { applySandboxMigrationPlan } from './sandboxMigrationPlan.js';
import { PRODUCTION_SCHEMA_PLAN } from './schemaVersion.js';

test('sandbox migration plan prepares all canonical module tables and is repeatable', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-plan-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    assert.deepEqual(await applySandboxMigrationPlan(database), [
      'v3-001-sandbox-module-schema',
      'v3-002-lesson-overlays',
      'v3-003-lesson-vocabulary',
    ]);
    assert.deepEqual(await applySandboxMigrationPlan(database), []);
    const tables = await database.execute("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'v3_%'");
    assert.ok(tables.rows.length >= 10);
    const marker = await database.execute({ sql: 'SELECT value FROM v3_backend_meta WHERE key = ?', args: ['schema_plan'] });
    assert.equal((marker.rows[0] as unknown as Record<string, unknown>).value, PRODUCTION_SCHEMA_PLAN);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
