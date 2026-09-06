import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('production entrypoint uses the gated production composition and never runs migrations', async () => {
  const directory = dirname(fileURLToPath(import.meta.url));
  const source = await readFile(join(directory, 'index.ts'), 'utf8');
  assert.match(source, /createProductionApp\(\)/);
  assert.doesNotMatch(source, /runSandboxMigrations|applySandboxMigrationPlan|initializeSandbox/);

  const production = await readFile(join(directory, 'createProductionApp.ts'), 'utf8');
  assert.match(production, /V3_WRITES_ENABLED/);
  assert.match(production, /ON CONFLICT\(telegram_id\) DO UPDATE SET/);
  assert.doesNotMatch(production, /role\s*=\s*excluded\.role|is_blocked\s*=\s*excluded\.is_blocked/);
  assert.doesNotMatch(production, /applySandboxMigrationPlan|runSandboxMigrations/);
});
