import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase, type SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import {
  gradeSandboxHomework,
  initializeSandboxHomeworkSchema,
  submitSandboxHomework,
} from './sandboxHomeworkRepository.js';

const withDatabase = async (run: (database: SandboxWriteDatabase) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-homework-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await initializeSandboxHomeworkSchema(database);
    await run(database);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
};

test('homework answer and asset references are committed and grading is idempotent', async () => {
  await withDatabase(async (database) => {
    const submitted = await submitSandboxHomework(database, {
      submissionId: 'homework-1',
      userId: 7,
      lessonId: 11,
      answerText: '<p>My answer</p>',
      createdAt: '2026-08-17T11:00:00.000Z',
      assets: [
        { assetId: 'asset-1', storageKey: 'uploads/asset-1', mimeType: 'image/png', bytes: 100, sha256: 'a'.repeat(64) },
        { assetId: 'asset-1', storageKey: 'uploads/asset-1', mimeType: 'image/png', bytes: 100, sha256: 'a'.repeat(64) },
      ],
    });
    assert.equal(submitted.status, 'pending');
    assert.equal(submitted.assets.length, 1);

    const edited = await submitSandboxHomework(database, {
      submissionId: 'homework-1', userId: 7, lessonId: 11, answerText: 'Corrected answer',
      createdAt: '2026-08-17T11:30:00.000Z', assets: [],
    });
    assert.equal(edited.answerText, 'Corrected answer');
    assert.equal(edited.assets.length, 0);
    assert.equal(edited.createdAt, submitted.createdAt);

    const graded = await gradeSandboxHomework(database, {
      submissionId: 'homework-1',
      grade: 9,
      teacherComment: 'Good work',
      gradedAt: '2026-08-17T12:00:00.000Z',
    });
    assert.equal(graded.status, 'graded');
    assert.equal(graded.grade, 9);
    await assert.rejects(() => submitSandboxHomework(database, {
      submissionId: 'homework-1', userId: 7, lessonId: 11, answerText: 'Change after grading',
      createdAt: '2026-08-17T12:30:00.000Z', assets: [],
    }), /Graded homework cannot be changed/);

    const retry = await gradeSandboxHomework(database, {
      submissionId: 'homework-1',
      grade: 2,
      teacherComment: 'Corrected feedback',
      gradedAt: '2026-08-17T13:00:00.000Z',
    });
    assert.equal(retry.grade, 2);
    assert.equal(retry.teacherComment, 'Corrected feedback');
    const same = await gradeSandboxHomework(database, {
      submissionId: 'homework-1', grade: 2, teacherComment: 'Corrected feedback', gradedAt: '2026-08-17T14:00:00.000Z',
    });
    assert.equal(same.gradedAt, retry.gradedAt);
  });
});

test('homework rejects invalid asset metadata and grades outside 0..10', async () => {
  await withDatabase(async (database) => {
    await assert.rejects(
      () => submitSandboxHomework(database, {
        submissionId: 'homework-2',
        userId: 7,
        lessonId: 11,
        answerText: 'answer',
        createdAt: '2026-08-17T11:00:00.000Z',
        assets: [{ assetId: 'bad', storageKey: 'uploads/bad', mimeType: 'image/png', bytes: -1, sha256: 'bad' }],
      }),
      /Invalid homework asset reference/,
    );
    await assert.rejects(
      () => gradeSandboxHomework(database, {
        submissionId: 'missing', grade: 11, teacherComment: '', gradedAt: '2026-08-17T12:00:00.000Z',
      }),
      /0 to 10/,
    );
  });
});
