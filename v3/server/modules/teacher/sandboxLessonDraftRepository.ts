import type { InStatement } from '@libsql/client';
import type { LessonBlock } from '../../../src/api/contracts.js';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { validateLessonDraft } from '../lessons/validateDraft.js';

export class LessonDraftConflictError extends Error {
  constructor() {
    super('Lesson draft revision conflict');
    this.name = 'LessonDraftConflictError';
  }
}

export type SandboxLessonDraft = {
  lessonId: number;
  contentRevision: number;
  blocks: readonly LessonBlock[];
  updatedBy: number;
  updatedAt: string;
};

const schemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_lesson_drafts (
    lesson_id INTEGER PRIMARY KEY,
    content_revision INTEGER NOT NULL,
    blocks_json TEXT NOT NULL,
    updated_by INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

export const initializeSandboxLessonDraftSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(schemaStatements);
};

export const getSandboxLessonDraft = async (
  database: SandboxWriteDatabase,
  lessonId: number,
): Promise<SandboxLessonDraft | null> => {
  const result = await database.execute({
    sql: 'SELECT lesson_id, content_revision, blocks_json, updated_by, updated_at FROM v3_lesson_drafts WHERE lesson_id = ?',
    args: [lessonId],
  });
  const row = result.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return null;
  let rawBlocks: unknown;
  try {
    rawBlocks = JSON.parse(String(row.blocks_json));
  } catch {
    throw new Error('Stored lesson draft JSON is invalid');
  }
  return {
    lessonId: Number(row.lesson_id),
    contentRevision: Number(row.content_revision),
    blocks: validateLessonDraft(rawBlocks),
    updatedBy: Number(row.updated_by),
    updatedAt: String(row.updated_at),
  };
};

export const saveSandboxLessonDraft = async (
  database: SandboxWriteDatabase,
  input: {
    lessonId: number;
    expectedRevision: number | null;
    blocks: unknown;
    updatedBy: number;
    updatedAt: string;
  },
): Promise<SandboxLessonDraft> => {
  const blocks = validateLessonDraft(input.blocks);
  // A missing revision means creation, never permission to overwrite a draft.
  const currentRevision = input.expectedRevision ?? 0;
  const nextRevision = currentRevision + 1;
  const result = await database.execute({
    sql: `INSERT INTO v3_lesson_drafts
      (lesson_id, content_revision, blocks_json, updated_by, updated_at)
      SELECT ?, ?, ?, ?, ?
      WHERE ? = 0 OR EXISTS (
        SELECT 1 FROM v3_lesson_drafts WHERE lesson_id = ? AND content_revision = ?
      )
      ON CONFLICT(lesson_id) DO UPDATE SET
        content_revision = excluded.content_revision,
        blocks_json = excluded.blocks_json,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at
      WHERE v3_lesson_drafts.content_revision = ?`,
    args: [input.lessonId, nextRevision, JSON.stringify(blocks), input.updatedBy, input.updatedAt,
      currentRevision, input.lessonId, currentRevision, currentRevision],
  });
  if (result.rowsAffected !== 1) throw new LessonDraftConflictError();
  return { lessonId: input.lessonId, contentRevision: nextRevision, blocks,
    updatedBy: input.updatedBy, updatedAt: input.updatedAt };
};
