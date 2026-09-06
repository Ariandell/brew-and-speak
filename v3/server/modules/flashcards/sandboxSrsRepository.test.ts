import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase, type SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxSrsSchema, reviewSandboxFlashcard, SrsIdempotencyConflictError } from './sandboxSrsRepository.js';

const withDatabase = async (run: (database: SandboxWriteDatabase) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-srs-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try { await initializeSandboxSrsSchema(database); await run(database); }
  finally { database.close(); await unlink(path).catch(() => undefined); }
};

test('SRS review is atomic and idempotent by key', async () => {
  await withDatabase(async (database) => {
    const now = new Date('2026-08-17T16:00:00.000Z');
    const first = await reviewSandboxFlashcard(database, { userId: 7, flashcardId: 500, correct: true, idempotencyKey: 'review-1', now });
    assert.equal(first.intervalDays, 1);
    const retry = await reviewSandboxFlashcard(database, { userId: 7, flashcardId: 500, correct: false, idempotencyKey: 'review-1', now });
    assert.deepEqual(retry, first);
    await assert.rejects(
      () => reviewSandboxFlashcard(database, { userId: 7, flashcardId: 501, correct: true, idempotencyKey: 'review-1', now }),
      (error: unknown) => error instanceof SrsIdempotencyConflictError,
    );
  });
});
