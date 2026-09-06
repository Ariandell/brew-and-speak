import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectLegacyInventory } from '../infrastructure/db/legacyInventory.js';
import { createReadOnlyDatabase } from '../infrastructure/db/readOnlySql.js';

const configuredPath = process.env.LEGACY_SQLITE_PATH ?? resolve(process.cwd(), '../server/database.sqlite');
if (!existsSync(configuredPath)) {
  throw new Error(`Legacy SQLite file does not exist: ${configuredPath}`);
}

const database = createReadOnlyDatabase({ url: `file:${configuredPath}` });
const report = await collectLegacyInventory(database);
console.log(JSON.stringify({ generatedAt: new Date().toISOString(), ...report }, null, 2));

