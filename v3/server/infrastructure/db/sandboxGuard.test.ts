import { strict as assert } from 'node:assert';
import test from 'node:test';
import { assertLocalSandboxPath, assertSandboxDatabaseUrl } from './sandboxGuard.js';

test('sandbox guard accepts local SQLite inputs', () => {
  assert.match(assertLocalSandboxPath('./snapshot.sqlite'), /snapshot\.sqlite$/);
  assert.equal(assertSandboxDatabaseUrl('file:./snapshot.sqlite'), 'file:./snapshot.sqlite');
});

test('sandbox guard rejects remote database inputs', () => {
  assert.throws(() => assertLocalSandboxPath('libsql://production.example'), /local SQLite paths only/);
  assert.throws(() => assertLocalSandboxPath('https://production.example/db'), /local SQLite paths only/);
  assert.throws(() => assertSandboxDatabaseUrl('libsql://production.example'), /file: SQLite URLs only/);
});
