import type { InStatement } from '@libsql/client';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { applySrsReview, type SrsState } from '../progress/srs.js';

export type SandboxSrsReview = {
  flashcardId: number;
  timesShown: number;
  timesCorrect: number;
  timesWrong: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string;
};

export class SrsIdempotencyConflictError extends Error {
  constructor() {
    super('SRS idempotency key was already used for another card');
    this.name = 'SrsIdempotencyConflictError';
  }
}

const schemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_flashcard_progress (
    user_id INTEGER NOT NULL,
    flashcard_id INTEGER NOT NULL,
    times_shown INTEGER NOT NULL DEFAULT 0,
    times_correct INTEGER NOT NULL DEFAULT 0,
    times_wrong INTEGER NOT NULL DEFAULT 0,
    ease_factor REAL NOT NULL DEFAULT 2.5,
    interval_days INTEGER NOT NULL DEFAULT 0,
    next_review_at TEXT,
    last_reviewed_at TEXT,
    PRIMARY KEY (user_id, flashcard_id)
  )`,
  `CREATE TABLE IF NOT EXISTS v3_flashcard_review_keys (
    idempotency_key TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    flashcard_id INTEGER NOT NULL,
    response_json TEXT NOT NULL
  )`,
];

const numberValue = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);

export const initializeSandboxSrsSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(schemaStatements);
};

const stateFor = async (database: SandboxWriteDatabase, userId: number, flashcardId: number, initialState: Partial<SrsState> = {}): Promise<Partial<SrsState>> => {
  const result = await database.execute({
    sql: `SELECT times_shown, times_correct, times_wrong, ease_factor, interval_days, next_review_at
      FROM v3_flashcard_progress WHERE user_id = ? AND flashcard_id = ?`,
    args: [userId, flashcardId],
  });
  const row = result.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return initialState;
  return {
    timesShown: numberValue(row.times_shown),
    timesCorrect: numberValue(row.times_correct),
    timesWrong: numberValue(row.times_wrong),
    easeFactor: numberValue(row.ease_factor),
    intervalDays: numberValue(row.interval_days),
    nextReviewAt: typeof row.next_review_at === 'string' ? new Date(row.next_review_at) : null,
  };
};

export const reviewSandboxFlashcard = async (
  database: SandboxWriteDatabase,
  input: { userId: number; flashcardId: number; correct: boolean; idempotencyKey: string; now: Date; initialState?: Partial<SrsState> },
): Promise<SandboxSrsReview> => {
  const existingKey = await database.execute({
    sql: 'SELECT user_id, flashcard_id, response_json FROM v3_flashcard_review_keys WHERE idempotency_key = ?',
    args: [input.idempotencyKey],
  });
  const existingRow = existingKey.rows[0] as unknown as Record<string, unknown> | undefined;
  if (existingRow) {
    if (numberValue(existingRow.user_id) !== input.userId || numberValue(existingRow.flashcard_id) !== input.flashcardId) {
      throw new SrsIdempotencyConflictError();
    }
    return JSON.parse(String(existingRow.response_json)) as SandboxSrsReview;
  }

  const result = applySrsReview(await stateFor(database, input.userId, input.flashcardId, input.initialState), input.correct, input.now);
  const response: SandboxSrsReview = {
    flashcardId: input.flashcardId,
    timesShown: result.timesShown,
    timesCorrect: result.timesCorrect,
    timesWrong: result.timesWrong,
    easeFactor: result.easeFactor,
    intervalDays: result.intervalDays,
    nextReviewAt: result.nextReviewAt.toISOString(),
  };
  await database.batch([
    {
      sql: `INSERT INTO v3_flashcard_progress
        (user_id, flashcard_id, times_shown, times_correct, times_wrong, ease_factor, interval_days, next_review_at, last_reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, flashcard_id) DO UPDATE SET
          times_shown = excluded.times_shown,
          times_correct = excluded.times_correct,
          times_wrong = excluded.times_wrong,
          ease_factor = excluded.ease_factor,
          interval_days = excluded.interval_days,
          next_review_at = excluded.next_review_at,
          last_reviewed_at = excluded.last_reviewed_at`,
      args: [input.userId, input.flashcardId, response.timesShown, response.timesCorrect, response.timesWrong, response.easeFactor, response.intervalDays, response.nextReviewAt, input.now.toISOString()],
    },
    {
      sql: 'INSERT INTO v3_flashcard_review_keys (idempotency_key, user_id, flashcard_id, response_json) VALUES (?, ?, ?, ?)',
      args: [input.idempotencyKey, input.userId, input.flashcardId, JSON.stringify(response)],
    },
  ]);
  return response;
};
