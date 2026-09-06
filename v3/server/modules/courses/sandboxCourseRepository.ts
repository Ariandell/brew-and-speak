import type { InStatement } from '@libsql/client';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import type { LegacyCourse } from '../legacy/repositories.js';

export type SandboxCourse = LegacyCourse;

const schemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_courses (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    course_order INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS v3_course_overrides (
    course_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    course_order INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0
  )`,
];

const numberValue = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);
const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';

export const initializeSandboxCourseSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch(schemaStatements);
};

const rowsToCreated = (rows: readonly unknown[]): SandboxCourse[] => rows.map((raw) => {
  const row = raw as Record<string, unknown>;
  return { id: numberValue(row.id), title: stringValue(row.title), description: stringValue(row.description), order: numberValue(row.course_order), lessonCount: 0 };
});

export const listSandboxCourses = async (
  database: SandboxWriteDatabase,
  legacyCourses: readonly LegacyCourse[],
): Promise<readonly SandboxCourse[]> => {
  const [createdResult, overrideResult] = await Promise.all([
    database.execute('SELECT id, title, description, course_order FROM v3_courses ORDER BY course_order, id'),
    database.execute('SELECT course_id, title, description, course_order, archived FROM v3_course_overrides'),
  ]);
  const courses = new Map<number, SandboxCourse>(legacyCourses.map((course) => [course.id, course]));
  for (const course of rowsToCreated(createdResult.rows)) courses.set(course.id, course);
  for (const raw of overrideResult.rows) {
    const row = raw as unknown as Record<string, unknown>;
    const id = numberValue(row.course_id);
    if (numberValue(row.archived) === 1) {
      courses.delete(id);
      continue;
    }
    courses.set(id, {
      id,
      title: stringValue(row.title),
      description: stringValue(row.description),
      order: numberValue(row.course_order),
      lessonCount: courses.get(id)?.lessonCount ?? 0,
    });
  }
  return [...courses.values()].sort((left, right) => left.order - right.order || left.id - right.id);
};

export const createSandboxCourse = async (
  database: SandboxWriteDatabase,
  input: { title: string; description: string; order: number },
): Promise<SandboxCourse> => {
  const result = await database.execute({
    sql: `INSERT INTO v3_courses (id, title, description, course_order)
      SELECT MAX(100000, COALESCE(MAX(id), 99999) + 1), ?, ?, ? FROM v3_courses
      RETURNING id`,
    args: [input.title, input.description, input.order],
  });
  const id = numberValue((result.rows[0] as unknown as Record<string, unknown> | undefined)?.id);
  if (!id) throw new Error('Course was not created');
  return { id, title: input.title, description: input.description, order: input.order, lessonCount: 0 };
};

export const updateSandboxCourse = async (
  database: SandboxWriteDatabase,
  input: { course: SandboxCourse; title?: string; description?: string; order?: number },
): Promise<SandboxCourse> => {
  const next = {
    title: input.title ?? input.course.title,
    description: input.description ?? input.course.description,
    order: input.order ?? input.course.order,
  };
  const created = await database.execute({ sql: 'SELECT id FROM v3_courses WHERE id = ?', args: [input.course.id] });
  if (created.rows.length > 0) {
    await database.batch([{
      sql: 'UPDATE v3_courses SET title = ?, description = ?, course_order = ? WHERE id = ?',
      args: [next.title, next.description, next.order, input.course.id],
    }]);
  } else {
    await database.batch([{
      sql: `INSERT INTO v3_course_overrides (course_id, title, description, course_order, archived)
        VALUES (?, ?, ?, ?, 0)
        ON CONFLICT(course_id) DO UPDATE SET title = excluded.title, description = excluded.description, course_order = excluded.course_order, archived = 0`,
      args: [input.course.id, next.title, next.description, next.order],
    }]);
  }
  return { id: input.course.id, ...next, lessonCount: input.course.lessonCount };
};

export const deleteSandboxCourse = async (database: SandboxWriteDatabase, course: SandboxCourse): Promise<void> => {
  const created = await database.execute({ sql: 'SELECT id FROM v3_courses WHERE id = ?', args: [course.id] });
  if (created.rows.length > 0) {
    await database.execute({ sql: 'DELETE FROM v3_courses WHERE id = ?', args: [course.id] });
    return;
  }
  await database.batch([{
    sql: `INSERT INTO v3_course_overrides (course_id, title, description, course_order, archived)
      VALUES (?, ?, ?, ?, 1)
      ON CONFLICT(course_id) DO UPDATE SET archived = 1`,
    args: [course.id, course.title, course.description, course.order],
  }]);
};
