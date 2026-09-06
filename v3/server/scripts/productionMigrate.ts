import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { collectLegacyInventory } from '../infrastructure/db/legacyInventory.js';
import { createReadOnlyDatabase } from '../infrastructure/db/readOnlySql.js';
import { applyV3MigrationPlan } from '../infrastructure/db/sandboxMigrationPlan.js';
import { createWriteDatabase } from '../infrastructure/db/writeSql.js';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
const confirmation = process.env.V3_MIGRATION_CONFIRM;
const backupReference = process.env.V3_BACKUP_REFERENCE?.trim();

if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
if (confirmation !== 'APPLY_V3_002_AFTER_VERIFIED_BACKUP') {
  throw new Error('Set V3_MIGRATION_CONFIRM=APPLY_V3_002_AFTER_VERIFIED_BACKUP only after verifying the backup');
}
if (!backupReference) throw new Error('V3_BACKUP_REFERENCE is required');

const readDatabase = createReadOnlyDatabase({ url, authToken });
const writeDatabase = createWriteDatabase({ url, authToken });
try {
  const before = await collectLegacyInventory(readDatabase);
  const beforeHash = createHash('sha256').update(JSON.stringify(before)).digest('hex');
  const applied = await applyV3MigrationPlan(writeDatabase);
  await writeDatabase.batch([{
    sql: `INSERT INTO v3_backend_meta (key, value) VALUES ('migration_backup_reference', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`, args: [backupReference],
  }, {
    sql: `INSERT INTO v3_backend_meta (key, value) VALUES ('legacy_inventory_before_sha256', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`, args: [beforeHash],
  }]);
  const after = await collectLegacyInventory(readDatabase);
  // The migration only adds v3_* tables; every inherited row count must remain identical.
  if (JSON.stringify(before.rowCounts) !== JSON.stringify(after.rowCounts)) {
    throw new Error('Legacy row counts changed during additive V3 migration');
  }
  if (before.contentFingerprintSha256 !== after.contentFingerprintSha256) {
    throw new Error('Legacy content changed during additive V3 migration');
  }
  const report = { generatedAt: new Date().toISOString(), backupReference, beforeHash, applied, before, after };
  const directory = resolve(process.cwd(), '.sandbox/production-migrations');
  await mkdir(directory, { recursive: true });
  const reportPath = resolve(directory, `v3-002-${Date.now()}.json`);
  await writeFile(reportPath, JSON.stringify(report, null, 2), { encoding: 'utf8', flag: 'wx' });
  console.log(JSON.stringify({ status: 'ok', reportPath, backupReference, beforeHash, applied }, null, 2));
} finally {
  writeDatabase.close();
}
