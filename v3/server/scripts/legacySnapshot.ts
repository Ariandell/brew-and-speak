import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectLegacyInventory } from '../infrastructure/db/legacyInventory.js';
import { createReadOnlyDatabase } from '../infrastructure/db/readOnlySql.js';
import { assertLocalSandboxPath, assertSandboxDatabaseUrl } from '../infrastructure/db/sandboxGuard.js';
import { createSqliteSnapshot } from '../infrastructure/db/sqliteSnapshot.js';

const sourcePath = assertLocalSandboxPath(process.env.LEGACY_SQLITE_PATH ?? resolve(process.cwd(), '../server/database.sqlite'));
const destinationDirectory = process.env.LEGACY_SNAPSHOT_DIR ?? resolve(process.cwd(), '.sandbox/snapshots');

if (!existsSync(sourcePath)) {
  throw new Error(`Legacy SQLite file does not exist: ${sourcePath}`);
}

const snapshot = await createSqliteSnapshot({
  sourcePath,
  destinationDirectory,
  label: 'legacy',
});
const database = createReadOnlyDatabase({ url: assertSandboxDatabaseUrl(`file:${snapshot.snapshotPath}`) });
const inventory = await collectLegacyInventory(database);

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  snapshot,
  inventory,
}, null, 2));
