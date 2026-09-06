import type { InStatement } from '@libsql/client';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';

export class HomeworkConflictError extends Error {}

export type HomeworkAssetReference = {
  assetId: string;
  storageKey: string;
  mimeType: string;
  bytes: number;
  sha256: string;
};

export type SandboxHomework = {
  submissionId: string;
  userId: number;
  lessonId: number;
  answerText: string;
  status: 'pending' | 'graded';
  grade: number | null;
  teacherComment: string | null;
  createdAt: string;
  gradedAt: string | null;
  assets: readonly HomeworkAssetReference[];
};

const schemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_homework_submissions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    answer_text TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'graded')),
    grade INTEGER,
    teacher_comment TEXT,
    created_at TEXT NOT NULL,
    graded_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS v3_homework_asset_refs (
    submission_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    storage_key TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    bytes INTEGER NOT NULL CHECK (bytes >= 0),
    sha256 TEXT NOT NULL,
    PRIMARY KEY (submission_id, asset_id),
    FOREIGN KEY (submission_id) REFERENCES v3_homework_submissions(id) ON DELETE CASCADE
  )`,
];

const rowNumber = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);

export const getSandboxHomework = async (database: SandboxWriteDatabase, submissionId: string): Promise<SandboxHomework | null> => {
  const submissionResult = await database.execute({
    sql: `SELECT id, user_id, lesson_id, answer_text, status, grade, teacher_comment, created_at, graded_at
      FROM v3_homework_submissions WHERE id = ?`,
    args: [submissionId],
  });
  const row = submissionResult.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return null;

  const assetsResult = await database.execute({
    sql: `SELECT asset_id, storage_key, mime_type, bytes, sha256
      FROM v3_homework_asset_refs WHERE submission_id = ? ORDER BY asset_id`,
    args: [submissionId],
  });
  return {
    submissionId: String(row.id),
    userId: rowNumber(row.user_id),
    lessonId: rowNumber(row.lesson_id),
    answerText: String(row.answer_text),
    status: row.status === 'graded' ? 'graded' : 'pending',
    grade: row.grade === null || row.grade === undefined ? null : rowNumber(row.grade),
    teacherComment: typeof row.teacher_comment === 'string' ? row.teacher_comment : null,
    createdAt: String(row.created_at),
    gradedAt: typeof row.graded_at === 'string' ? row.graded_at : null,
    assets: assetsResult.rows.map((asset) => {
      const assetRow = asset as unknown as Record<string, unknown>;
      return {
        assetId: String(assetRow.asset_id),
        storageKey: String(assetRow.storage_key),
        mimeType: String(assetRow.mime_type),
        bytes: rowNumber(assetRow.bytes),
        sha256: String(assetRow.sha256),
      };
    }),
  };
};

export const listSandboxHomework = async (
  database: SandboxWriteDatabase,
  input: { userId?: number; status?: 'pending' | 'graded' },
): Promise<readonly SandboxHomework[]> => {
  const conditions: string[] = [];
  const args: (string | number)[] = [];
  if (input.userId !== undefined) {
    conditions.push('user_id = ?');
    args.push(input.userId);
  }
  if (input.status !== undefined) {
    conditions.push('status = ?');
    args.push(input.status);
  }
  const result = await database.execute({
    sql: `SELECT id FROM v3_homework_submissions${conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''} ORDER BY created_at DESC, id DESC`,
    args,
  });
  const submissions: SandboxHomework[] = [];
  for (const row of result.rows) {
    const id = String((row as unknown as Record<string, unknown>).id);
    const submission = await getSandboxHomework(database, id);
    if (submission) submissions.push(submission);
  }
  return submissions;
};

export const initializeSandboxHomeworkSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(schemaStatements);
};

export const submitSandboxHomework = async (
  database: SandboxWriteDatabase,
  input: {
    submissionId: string;
    userId: number;
    lessonId: number;
    answerText: string;
    createdAt: string;
    assets: readonly HomeworkAssetReference[];
  },
): Promise<SandboxHomework> => {
  const existing = await getSandboxHomework(database, input.submissionId);
  if (existing) {
    if (existing.userId !== input.userId || existing.lessonId !== input.lessonId) {
      throw new HomeworkConflictError('Homework submission identity conflict');
    }
  }

  const uniqueAssets = [...new Map(input.assets.map((asset) => [asset.assetId, asset])).values()];
  if (uniqueAssets.some((asset) => asset.bytes < 0 || !asset.assetId || !asset.storageKey || !asset.sha256)) {
    throw new Error('Invalid homework asset reference');
  }

  if (existing) {
    const ordered = (assets: readonly HomeworkAssetReference[]) => [...assets].sort((a, b) => a.assetId.localeCompare(b.assetId));
    if (existing.answerText === input.answerText && JSON.stringify(ordered(existing.assets)) === JSON.stringify(ordered(uniqueAssets))) return existing;
    if (existing.status === 'graded') throw new HomeworkConflictError('Graded homework cannot be changed');
    const pending = `EXISTS (SELECT 1 FROM v3_homework_submissions WHERE id = ? AND user_id = ? AND status = 'pending')`;
    const updates: InStatement[] = [{
      sql: `UPDATE v3_homework_submissions SET answer_text = ? WHERE id = ? AND user_id = ? AND status = 'pending'`,
      args: [input.answerText, input.submissionId, input.userId],
    }, {
      sql: `DELETE FROM v3_homework_asset_refs WHERE submission_id = ? AND ${pending}`,
      args: [input.submissionId, input.submissionId, input.userId],
    }, ...uniqueAssets.map(asset => ({
      sql: `INSERT INTO v3_homework_asset_refs (submission_id, asset_id, storage_key, mime_type, bytes, sha256)
        SELECT ?, ?, ?, ?, ?, ? WHERE ${pending}`,
      args: [input.submissionId, asset.assetId, asset.storageKey, asset.mimeType, asset.bytes, asset.sha256, input.submissionId, input.userId],
    }))];
    const updated = await database.batch(updates);
    if (updated[0].rowsAffected !== 1) throw new HomeworkConflictError('Homework was graded while editing');
    const saved = await getSandboxHomework(database, input.submissionId);
    if (!saved) throw new Error('Homework submission disappeared');
    return saved;
  }

  const statements: InStatement[] = [{
    sql: `INSERT INTO v3_homework_submissions
      (id, user_id, lesson_id, answer_text, status, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?)`,
    args: [input.submissionId, input.userId, input.lessonId, input.answerText, input.createdAt],
  }];
  statements.push(...uniqueAssets.map((asset) => ({
    sql: `INSERT INTO v3_homework_asset_refs
      (submission_id, asset_id, storage_key, mime_type, bytes, sha256)
      VALUES (?, ?, ?, ?, ?, ?)`,
    args: [input.submissionId, asset.assetId, asset.storageKey, asset.mimeType, asset.bytes, asset.sha256],
  })));
  await database.batch(statements);

  const created = await getSandboxHomework(database, input.submissionId);
  if (!created) throw new Error('Homework submission was not created');
  return created;
};

export const gradeSandboxHomework = async (
  database: SandboxWriteDatabase,
  input: { submissionId: string; grade: number; teacherComment: string; gradedAt: string },
): Promise<SandboxHomework> => {
  if (!Number.isInteger(input.grade) || input.grade < 0 || input.grade > 10) {
    throw new Error('Homework grade must be an integer from 0 to 10');
  }
  const existing = await getSandboxHomework(database, input.submissionId);
  if (!existing) throw new Error('Homework submission does not exist');
  if (existing.status === 'graded' && existing.grade === input.grade && existing.teacherComment === input.teacherComment) return existing;

  await database.batch([{
    sql: `UPDATE v3_homework_submissions
      SET status = 'graded', grade = ?, teacher_comment = ?, graded_at = ?
      WHERE id = ?`,
    args: [input.grade, input.teacherComment, input.gradedAt, input.submissionId],
  }]);
  const graded = await getSandboxHomework(database, input.submissionId);
  if (!graded || graded.status !== 'graded') throw new Error('Homework was not graded');
  return graded;
};
