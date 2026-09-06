import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxStudentControlSchema, isSandboxUserBlocked, setSandboxStudentBlocked } from './sandboxStudentControlRepository.js';

test('sandbox student control is explicit and idempotent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-control-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await initializeSandboxStudentControlSchema(database);
    assert.equal(await isSandboxUserBlocked(database, 7), false);
    assert.equal(await setSandboxStudentBlocked(database, { studentId: 7, blocked: true, updatedBy: 9, updatedAt: '2026-08-17T10:00:00.000Z' }), true);
    assert.equal(await setSandboxStudentBlocked(database, { studentId: 7, blocked: false, updatedBy: 9, updatedAt: '2026-08-17T10:01:00.000Z' }), false);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
