import type { InStatement } from '@libsql/client';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';

const schemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_student_controls (
    user_id INTEGER PRIMARY KEY,
    is_blocked INTEGER NOT NULL CHECK (is_blocked IN (0, 1)),
    updated_by INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  )`,
];

export const initializeSandboxStudentControlSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(schemaStatements);
};

export const isSandboxUserBlocked = async (database: SandboxWriteDatabase, userId: number): Promise<boolean> => {
  const result = await database.execute({ sql: 'SELECT is_blocked FROM v3_student_controls WHERE user_id = ?', args: [userId] });
  const row = result.rows[0] as unknown as Record<string, unknown> | undefined;
  return row ? Number(row.is_blocked) === 1 : false;
};

export const setSandboxStudentBlocked = async (
  database: SandboxWriteDatabase,
  input: { studentId: number; blocked: boolean; updatedBy: number; updatedAt: string },
): Promise<boolean> => {
  await database.batch([{
    sql: `INSERT INTO v3_student_controls (user_id, is_blocked, updated_by, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET is_blocked = excluded.is_blocked, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
    args: [input.studentId, input.blocked ? 1 : 0, input.updatedBy, input.updatedAt],
  }]);
  return isSandboxUserBlocked(database, input.studentId);
};
