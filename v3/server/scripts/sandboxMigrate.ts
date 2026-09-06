import { createSandboxWriteDatabase } from '../infrastructure/db/sandboxWriteSql.js';
import { applySandboxMigrationPlan } from '../infrastructure/db/sandboxMigrationPlan.js';

const configuredPath = process.env.SANDBOX_DATABASE_PATH;
if (!configuredPath) {
  throw new Error('SANDBOX_DATABASE_PATH is required; migration refuses implicit database targets');
}

const database = createSandboxWriteDatabase({ url: `file:${configuredPath}`, mode: 'sandbox' });
try {
  const applied = await applySandboxMigrationPlan(database);
  console.log(JSON.stringify({ status: 'ok', applied }, null, 2));
} finally {
  database.close();
}
