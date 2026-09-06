import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase, type SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import {
  getSandboxLessonDraft,
  initializeSandboxLessonDraftSchema,
  LessonDraftConflictError,
  saveSandboxLessonDraft,
} from './sandboxLessonDraftRepository.js';

const withDatabase = async (run: (database: SandboxWriteDatabase) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-editor-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await initializeSandboxLessonDraftSchema(database);
    await run(database);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
};

test('lesson draft save is validated and protected by optimistic revision', async () => {
  await withDatabase(async (database) => {
    const first = await saveSandboxLessonDraft(database, {
      lessonId: 10,
      expectedRevision: null,
      updatedBy: 7,
      updatedAt: '2026-08-17T14:00:00.000Z',
      blocks: [{ id: 1, order: 0, type: 'text', html: '<p>Hello</p>' }],
    });
    assert.equal(first.contentRevision, 1);
    const loaded = await getSandboxLessonDraft(database, 10);
    assert.equal(loaded?.blocks[0].type, 'text');

    await assert.rejects(
      () => saveSandboxLessonDraft(database, {
        lessonId: 10, expectedRevision: 0, updatedBy: 7, updatedAt: 'later',
        blocks: [{ id: 1, order: 0, type: 'text', html: '<p>Changed</p>' }],
      }),
      (error: unknown) => error instanceof LessonDraftConflictError,
    );
    const second = await saveSandboxLessonDraft(database, {
      lessonId: 10, expectedRevision: 1, updatedBy: 7, updatedAt: '2026-08-17T15:00:00.000Z',
      blocks: [{ id: 1, order: 0, type: 'text', html: '<p>Changed</p>' }],
    });
    assert.equal(second.contentRevision, 2);
    const competing = await Promise.allSettled(['Left', 'Right'].map((html) => saveSandboxLessonDraft(database, {
      lessonId: 10, expectedRevision: 2, updatedBy: 7, updatedAt: '2026-08-17T16:00:00.000Z',
      blocks: [{ id: 1, order: 0, type: 'text', html }],
    })));
    assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
    const rejected = competing.find((result) => result.status === 'rejected');
    assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof LessonDraftConflictError);
    assert.equal((await getSandboxLessonDraft(database, 10))?.contentRevision, 3);
    for (const [lessonId, expectedRevision] of [[10, null], [11, 2]] as const) {
      await assert.rejects(() => saveSandboxLessonDraft(database, {
        lessonId, expectedRevision, updatedBy: 7, updatedAt: 'later',
        blocks: [{ id: 1, order: 0, type: 'text', html: 'Must not overwrite or invent a revision' }],
      }), LessonDraftConflictError);
    }
  });
});
