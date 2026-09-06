import type { InStatement } from '@libsql/client';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';

const schemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_enrollments (
    user_id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    enrolled_at TEXT NOT NULL
  )`,
];

export const initializeSandboxEnrollmentSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(schemaStatements);
};

export const getSandboxEnrollment = async (
  database: SandboxWriteDatabase,
  userId: number,
): Promise<number | null> => {
  const result = await database.execute({
    sql: 'SELECT course_id FROM v3_enrollments WHERE user_id = ?',
    args: [userId],
  });
  const row = result.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!row) return null;
  const courseId = Number(row.course_id);
  return Number.isInteger(courseId) && courseId > 0 ? courseId : null;
};

export const chooseSandboxEnrollment = async (
  database: SandboxWriteDatabase,
  input: { userId: number; courseId: number; enrolledAt: string },
): Promise<number> => {
  await database.batch([{
    sql: `INSERT INTO v3_enrollments (user_id, course_id, enrolled_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET course_id = excluded.course_id, enrolled_at = excluded.enrolled_at`,
    args: [input.userId, input.courseId, input.enrolledAt],
  }]);
  const selected = await getSandboxEnrollment(database, input.userId);
  if (selected === null) throw new Error('Sandbox enrollment was not saved');
  return selected;
};
