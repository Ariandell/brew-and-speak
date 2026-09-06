import type { InStatement } from '@libsql/client';
import { lessonBlockSchema, type LessonBlock } from '../../../src/api/contracts.js';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';

export type AttemptOutcome = 'correct' | 'wrong';

export type StartAttemptInput = {
  attemptId: string;
  userId: number;
  lessonId: number;
  contentRevision: string;
  scoredBlockIds: readonly string[];
  blocks?: readonly LessonBlock[];
  startedAt: string;
};

export type AttemptSnapshot = {
  attemptId: string;
  userId: number;
  lessonId: number;
  contentRevision: string;
  status: 'active' | 'finished';
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  score: number | null;
  startedAt: string;
  finishedAt: string | null;
};

export type RecordAnswerResult = {
  recorded: boolean;
  reason: 'recorded' | 'duplicate' | 'unknown_block' | 'finished' | 'missing_attempt';
};

const schemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_attempt_block_snapshots (
    attempt_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    content TEXT NOT NULL,
    PRIMARY KEY (attempt_id, block_id),
    FOREIGN KEY (attempt_id) REFERENCES v3_attempts(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS v3_attempts (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    content_revision TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('active', 'finished')),
    score INTEGER,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    skipped_count INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    finished_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS v3_attempt_scored_blocks (
    attempt_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    PRIMARY KEY (attempt_id, block_id),
    FOREIGN KEY (attempt_id) REFERENCES v3_attempts(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS v3_attempt_answers (
    attempt_id TEXT NOT NULL,
    block_id TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('correct', 'wrong')),
    answered_at TEXT NOT NULL,
    PRIMARY KEY (attempt_id, block_id),
    FOREIGN KEY (attempt_id, block_id)
      REFERENCES v3_attempt_scored_blocks(attempt_id, block_id)
      ON DELETE CASCADE
  )`,
];

const numberValue = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);

const rowToAttempt = (row: Record<string, unknown>): AttemptSnapshot => ({
  attemptId: String(row.id),
  userId: numberValue(row.user_id),
  lessonId: numberValue(row.lesson_id),
  contentRevision: String(row.content_revision),
  status: row.status === 'finished' ? 'finished' : 'active',
  total: numberValue(row.total),
  correct: numberValue(row.correct_count),
  wrong: numberValue(row.wrong_count),
  skipped: numberValue(row.skipped_count),
  score: row.score === null || row.score === undefined ? null : numberValue(row.score),
  startedAt: String(row.started_at),
  finishedAt: typeof row.finished_at === 'string' ? row.finished_at : null,
});

const selectAttempt = async (
  database: SandboxWriteDatabase,
  attemptId: string,
  userId?: number,
): Promise<AttemptSnapshot | null> => {
  const ownerClause = userId === undefined ? '' : ' AND attempts.user_id = ?';
  const args = userId === undefined ? [attemptId] : [attemptId, userId];
  const result = await database.execute({
    sql: `SELECT
      attempts.id,
      attempts.user_id,
      attempts.lesson_id,
      attempts.content_revision,
      attempts.status,
      COUNT(scored.block_id) AS total,
      attempts.correct_count,
      attempts.wrong_count,
      attempts.skipped_count,
      attempts.score,
      attempts.started_at,
      attempts.finished_at
    FROM v3_attempts attempts
    LEFT JOIN v3_attempt_scored_blocks scored ON scored.attempt_id = attempts.id
    WHERE attempts.id = ?${ownerClause}
    GROUP BY attempts.id`,
    args,
  });
  const row = result.rows[0] as unknown as Record<string, unknown> | undefined;
  return row ? rowToAttempt(row) : null;
};

export const initializeSandboxAttemptSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(schemaStatements);
};

export const startSandboxAttempt = async (
  database: SandboxWriteDatabase,
  input: StartAttemptInput,
): Promise<AttemptSnapshot> => {
  const scoredBlockIds = [...new Set(input.scoredBlockIds)].filter(Boolean);
  const existing = await selectAttempt(database, input.attemptId);
  if (existing) {
    if (
      existing.userId !== input.userId
      || existing.lessonId !== input.lessonId
      || existing.contentRevision !== input.contentRevision
    ) {
      throw new Error('Attempt identity or content revision conflict');
    }
    return existing;
  }

  const statements: InStatement[] = [{
    sql: `INSERT INTO v3_attempts
      (id, user_id, lesson_id, content_revision, status, started_at)
      VALUES (?, ?, ?, ?, 'active', ?)`,
    args: [input.attemptId, input.userId, input.lessonId, input.contentRevision, input.startedAt],
  }];
  statements.push(...scoredBlockIds.map((blockId) => ({
    sql: 'INSERT INTO v3_attempt_scored_blocks (attempt_id, block_id) VALUES (?, ?)',
    args: [input.attemptId, blockId],
  })));
  statements.push(...(input.blocks ?? []).filter(block => scoredBlockIds.includes(String(block.id))).map(block => ({
    sql: 'INSERT INTO v3_attempt_block_snapshots (attempt_id, block_id, content) VALUES (?, ?, ?)',
    args: [input.attemptId, String(block.id), JSON.stringify(block)],
  })));
  await database.batch(statements);

  const started = await selectAttempt(database, input.attemptId);
  if (!started) throw new Error('Attempt was not created');
  return started;
};

export const getAttemptBlock = async (
  database: SandboxWriteDatabase, attemptId: string, userId: number, blockId: string,
): Promise<LessonBlock | null> => {
  const result = await database.execute({
    sql: `SELECT snapshots.content FROM v3_attempt_block_snapshots snapshots
      JOIN v3_attempts attempts ON attempts.id = snapshots.attempt_id
      WHERE attempts.id = ? AND attempts.user_id = ? AND snapshots.block_id = ?`,
    args: [attemptId, userId, blockId],
  });
  const content = result.rows[0]?.content;
  return typeof content === 'string' ? lessonBlockSchema.parse(JSON.parse(content)) : null;
};

export const recordSandboxAttemptAnswer = async (
  database: SandboxWriteDatabase,
  input: { attemptId: string; userId?: number; blockId: string; outcome: AttemptOutcome; answeredAt: string },
): Promise<RecordAnswerResult> => {
  const ownerClause = input.userId === undefined ? '' : ' AND user_id = ?';
  const ownerArgs = input.userId === undefined ? [] : [input.userId];
  const result = await database.batch([
    {
      sql: `INSERT OR IGNORE INTO v3_attempt_answers (attempt_id, block_id, outcome, answered_at)
        SELECT ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM v3_attempts WHERE id = ? AND status = 'active'${ownerClause}
        )
        AND EXISTS (
          SELECT 1 FROM v3_attempt_scored_blocks WHERE attempt_id = ? AND block_id = ?
        )`,
      args: [
        input.attemptId,
        input.blockId,
        input.outcome,
        input.answeredAt,
        input.attemptId,
        ...ownerArgs,
        input.attemptId,
        input.blockId,
      ],
    },
    {
      sql: 'SELECT changes() AS inserted',
      args: [],
    },
  ]);

  const inserted = numberValue((result[1]?.rows[0] as unknown as Record<string, unknown> | undefined)?.inserted);
  if (inserted === 1) return { recorded: true, reason: 'recorded' };

  const attempt = await selectAttempt(database, input.attemptId, input.userId);
  if (!attempt) return { recorded: false, reason: 'missing_attempt' };
  if (attempt.status === 'finished') return { recorded: false, reason: 'finished' };
  const block = await database.execute({
    sql: 'SELECT 1 AS present FROM v3_attempt_scored_blocks WHERE attempt_id = ? AND block_id = ?',
    args: [input.attemptId, input.blockId],
  });
  if (block.rows.length === 0) return { recorded: false, reason: 'unknown_block' };
  return { recorded: false, reason: 'duplicate' };
};

export const finishSandboxAttempt = async (
  database: SandboxWriteDatabase,
  input: { attemptId: string; userId?: number; finishedAt: string },
): Promise<AttemptSnapshot> => {
  const existing = await selectAttempt(database, input.attemptId, input.userId);
  if (!existing) throw new Error('Attempt does not exist');
  if (existing.status === 'finished') return existing;

  await database.batch([{
    sql: `UPDATE v3_attempts
      SET status = 'finished',
          correct_count = (
            SELECT COUNT(*) FROM v3_attempt_answers
            WHERE attempt_id = ? AND outcome = 'correct'
          ),
          wrong_count = (
            SELECT COUNT(*) FROM v3_attempt_answers
            WHERE attempt_id = ? AND outcome = 'wrong'
          ),
          skipped_count = (
            SELECT COUNT(*) FROM v3_attempt_scored_blocks scored
            WHERE scored.attempt_id = ?
              AND NOT EXISTS (
                SELECT 1 FROM v3_attempt_answers answers
                WHERE answers.attempt_id = scored.attempt_id
                  AND answers.block_id = scored.block_id
              )
          ),
          score = CASE
            WHEN (SELECT COUNT(*) FROM v3_attempt_scored_blocks WHERE attempt_id = ?) = 0 THEN 10
            ELSE ROUND(
              (
                SELECT COUNT(*) FROM v3_attempt_answers
                WHERE attempt_id = ? AND outcome = 'correct'
              ) * 10.0 /
              (SELECT COUNT(*) FROM v3_attempt_scored_blocks WHERE attempt_id = ?)
            )
          END,
          finished_at = ?
      WHERE id = ? AND status = 'active'${input.userId === undefined ? '' : ' AND user_id = ?'}`,
    args: [
      input.attemptId,
      input.attemptId,
      input.attemptId,
      input.attemptId,
      input.attemptId,
      input.attemptId,
      input.finishedAt,
      input.attemptId,
      ...(input.userId === undefined ? [] : [input.userId]),
    ],
  }]);

  const finished = await selectAttempt(database, input.attemptId, input.userId);
  if (!finished || finished.status !== 'finished') throw new Error('Attempt was not finished');
  return finished;
};
