import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase, type SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { chooseSandboxEnrollment, getSandboxEnrollment, initializeSandboxEnrollmentSchema } from './sandboxEnrollmentRepository.js';

test('sandbox enrollment is idempotent per internal user and can be changed explicitly', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-enrollment-repo-'));
  const path = join(root, 'sandbox.sqlite');
  const database: SandboxWriteDatabase = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await initializeSandboxEnrollmentSchema(database);
    assert.equal(await getSandboxEnrollment(database, 7), null);
    assert.equal(await chooseSandboxEnrollment(database, { userId: 7, courseId: 2, enrolledAt: '2026-08-17T10:00:00.000Z' }), 2);
    assert.equal(await chooseSandboxEnrollment(database, { userId: 7, courseId: 3, enrolledAt: '2026-08-17T10:01:00.000Z' }), 3);
    assert.equal(await getSandboxEnrollment(database, 8), null);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
