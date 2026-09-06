import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { effectiveCoursePathRecords } from './effectiveCoursePath.js';
import { deriveCoursePath } from './coursePath.js';
import { createSandboxWriteDatabase, type SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import {
  finishSandboxAttempt,
  getAttemptBlock,
  initializeSandboxAttemptSchema,
  recordSandboxAttemptAnswer,
  startSandboxAttempt,
} from './sandboxAttemptRepository.js';

const withDatabase = async (run: (database: SandboxWriteDatabase) => Promise<void>): Promise<void> => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-attempt-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await initializeSandboxAttemptSchema(database);
    await run(database);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
};

test('completion opens the next lesson after 24h without retakes postponing it or leaking progress', async () => {
  await withDatabase(async database => {
    const records = [10, 11].map((lessonId, order) => ({ lessonId, order, title: String(lessonId),
      status: null, unlocksAt: null, completedAt: null, homeworkStatus: null, homeworkGrade: null, hasHomework: false }));
    for (const [attemptId, finishedAt] of [['first', '2026-09-01T10:00:00.000Z'], ['retake', '2026-09-03T10:00:00.000Z']]) {
      await startSandboxAttempt(database, { attemptId, userId: 7, lessonId: 10, contentRevision: 'r1',
        scoredBlockIds: [], startedAt: finishedAt });
      await finishSandboxAttempt(database, { attemptId, userId: 7, finishedAt });
    }
    const merged = await effectiveCoursePathRecords(database, 7, records);
    assert.equal(merged[0].completedAt, '2026-09-03T10:00:00.000Z');
    assert.equal(merged[1].unlocksAt, '2026-09-02T10:00:00.000Z');
    const user = { id: 7, telegramId: '42', name: 'Student', username: null, role: 'student' as const,
      isBlocked: false, enrolledCourseId: 2 };
    assert.equal(deriveCoursePath(user, merged, new Date('2026-09-02T09:59:59Z')).items[1].status, 'locked');
    assert.equal(deriveCoursePath(user, merged, new Date('2026-09-02T10:00:00Z')).items[1].status, 'available');
    assert.deepEqual(await effectiveCoursePathRecords(database, 8, records), records);
    assert.equal(records[0].status, null);
  });
});

test('attempt answer keys are frozen and scoped to their owner', async () => {
  await withDatabase(async database => {
    const block = { id: 100, order: 0, type: 'quiz' as const, question: 'Q', options: ['A', 'B'], correctOption: 'A' };
    await startSandboxAttempt(database, {
      attemptId: 'snapshot', userId: 7, lessonId: 11, contentRevision: 'r1',
      scoredBlockIds: ['100'], blocks: [block], startedAt: '2026-09-05T10:00:00.000Z',
    });
    block.correctOption = 'B';
    const frozen = await getAttemptBlock(database, 'snapshot', 7, '100');
    assert.equal(frozen?.type === 'quiz' && frozen.correctOption, 'A');
    assert.equal(await getAttemptBlock(database, 'snapshot', 8, '100'), null);
  });
});

test('attempt snapshot and first-answer invariant survive finish retry', async () => {
  await withDatabase(async (database) => {
    const started = await startSandboxAttempt(database, {
      attemptId: 'attempt-1',
      userId: 7,
      lessonId: 11,
      contentRevision: 'revision-1',
      scoredBlockIds: ['a', 'b', 'c', 'd'],
      startedAt: '2026-08-17T10:00:00.000Z',
    });
    assert.equal(started.total, 4);

    assert.deepEqual(await recordSandboxAttemptAnswer(database, {
      attemptId: 'attempt-1', userId: 8, blockId: 'a', outcome: 'correct', answeredAt: '2026-08-17T10:00:30.000Z',
    }), { recorded: false, reason: 'missing_attempt' });
    await assert.rejects(
      () => finishSandboxAttempt(database, { attemptId: 'attempt-1', userId: 8, finishedAt: '2026-08-17T10:00:40.000Z' }),
      /does not exist/,
    );

    const duplicateStart = await startSandboxAttempt(database, {
      attemptId: 'attempt-1',
      userId: 7,
      lessonId: 11,
      contentRevision: 'revision-1',
      scoredBlockIds: ['different'],
      startedAt: '2026-08-17T10:01:00.000Z',
    });
    assert.equal(duplicateStart.total, 4);

    assert.deepEqual(await recordSandboxAttemptAnswer(database, {
      attemptId: 'attempt-1', blockId: 'a', outcome: 'wrong', answeredAt: '2026-08-17T10:02:00.000Z',
    }), { recorded: true, reason: 'recorded' });
    assert.deepEqual(await recordSandboxAttemptAnswer(database, {
      attemptId: 'attempt-1', blockId: 'a', outcome: 'correct', answeredAt: '2026-08-17T10:03:00.000Z',
    }), { recorded: false, reason: 'duplicate' });
    assert.deepEqual(await recordSandboxAttemptAnswer(database, {
      attemptId: 'attempt-1', blockId: 'unknown', outcome: 'correct', answeredAt: '2026-08-17T10:04:00.000Z',
    }), { recorded: false, reason: 'unknown_block' });
    assert.deepEqual(await recordSandboxAttemptAnswer(database, {
      attemptId: 'attempt-1', blockId: 'b', outcome: 'correct', answeredAt: '2026-08-17T10:05:00.000Z',
    }), { recorded: true, reason: 'recorded' });

    const finished = await finishSandboxAttempt(database, {
      attemptId: 'attempt-1',
      finishedAt: '2026-08-17T10:06:00.000Z',
    });
    assert.deepEqual({
      status: finished.status,
      total: finished.total,
      correct: finished.correct,
      wrong: finished.wrong,
      skipped: finished.skipped,
      score: finished.score,
    }, { status: 'finished', total: 4, correct: 1, wrong: 1, skipped: 2, score: 3 });

    assert.deepEqual(await recordSandboxAttemptAnswer(database, {
      attemptId: 'attempt-1', blockId: 'c', outcome: 'correct', answeredAt: '2026-08-17T10:07:00.000Z',
    }), { recorded: false, reason: 'finished' });
    const finishRetry = await finishSandboxAttempt(database, {
      attemptId: 'attempt-1',
      finishedAt: '2026-08-17T10:08:00.000Z',
    });
    assert.equal(finishRetry.finishedAt, '2026-08-17T10:06:00.000Z');
  });
});

test('attempt start rejects a changed content revision for the same attempt id', async () => {
  await withDatabase(async (database) => {
    await startSandboxAttempt(database, {
      attemptId: 'attempt-2',
      userId: 7,
      lessonId: 11,
      contentRevision: 'revision-1',
      scoredBlockIds: ['a'],
      startedAt: '2026-08-17T10:00:00.000Z',
    });
    await assert.rejects(
      () => startSandboxAttempt(database, {
        attemptId: 'attempt-2',
        userId: 7,
        lessonId: 11,
        contentRevision: 'revision-2',
        scoredBlockIds: ['a'],
        startedAt: '2026-08-17T10:00:00.000Z',
      }),
      /conflict/,
    );
  });
});
