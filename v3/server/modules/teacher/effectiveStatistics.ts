import type { ReadOnlyDatabase } from '../../infrastructure/db/readOnlySql.js';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { listSandboxCourses } from '../courses/sandboxCourseRepository.js';
import type { LegacyTeacherStatistics } from '../legacy/repositories.js';
import { createLegacyReadRepositories } from '../legacy/repositories.js';
import { listEffectiveLessonSummaries } from '../lessons/sandboxLessonRepository.js';

const integer = (value: unknown, field: string): number => {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`Statistics row has invalid ${field}`);
  return number;
};

const positiveInteger = (value: unknown, field: string): number => {
  const number = integer(value, field);
  if (number === 0) throw new Error(`Statistics row has invalid ${field}`);
  return number;
};

const completionKey = (userId: unknown, lessonId: unknown): string => (
  `${positiveInteger(userId, 'user_id')}:${positiveInteger(lessonId, 'lesson_id')}`
);

/**
 * Produces one production-facing statistics snapshot from immutable legacy data
 * plus additive V3 tables. Queries intentionally fail closed when either schema
 * is unavailable; this function never creates or mutates tables.
 */
export const getEffectiveTeacherStatistics = async (
  readDatabase: ReadOnlyDatabase,
  writeDatabase: SandboxWriteDatabase,
): Promise<LegacyTeacherStatistics> => {
  const repositories = createLegacyReadRepositories(readDatabase);
  const [
    students,
    legacyStatistics,
    legacyCourses,
    legacyCompletions,
    v3Completions,
    controls,
    pendingV3Homework,
  ] = await Promise.all([
    repositories.listStudents(),
    repositories.getTeacherStatistics(),
    repositories.listCourses(),
    readDatabase.execute(`SELECT user_id, lesson_id FROM user_progress WHERE status = 'completed'`),
    writeDatabase.execute(`SELECT DISTINCT user_id, lesson_id FROM v3_attempts WHERE status = 'finished'`),
    writeDatabase.execute('SELECT user_id, is_blocked FROM v3_student_controls'),
    writeDatabase.execute(`SELECT COUNT(*) AS count FROM v3_homework_submissions WHERE status = 'pending'`),
  ]);

  const courses = await listSandboxCourses(writeDatabase, legacyCourses);
  const effectiveLessonLists = await Promise.all(courses.map((course) => (
    repositories.listLessonSummaries(course.id).then((legacyLessons) => (
      listEffectiveLessonSummaries(writeDatabase, course.id, legacyLessons)
    ))
  )));
  const completionKeys = new Set<string>();
  for (const row of legacyCompletions.rows) {
    const value = row as unknown as Record<string, unknown>;
    completionKeys.add(completionKey(value.user_id, value.lesson_id));
  }
  for (const row of v3Completions.rows) {
    const value = row as unknown as Record<string, unknown>;
    completionKeys.add(completionKey(value.user_id, value.lesson_id));
  }

  const v3Blocked = new Set<number>();
  for (const row of controls.rows) {
    const value = row as unknown as Record<string, unknown>;
    const userId = positiveInteger(value.user_id, 'user_id');
    const isBlocked = integer(value.is_blocked, 'is_blocked');
    if (isBlocked !== 0 && isBlocked !== 1) throw new Error('Statistics row has invalid is_blocked');
    if (isBlocked === 1) v3Blocked.add(userId);
  }

  const pendingRow = pendingV3Homework.rows[0] as unknown as Record<string, unknown> | undefined;
  const pendingV3Count = integer(pendingRow?.count ?? 0, 'pending homework count');
  return {
    studentCount: students.length,
    blockedStudentCount: students.filter((student) => student.isBlocked || v3Blocked.has(student.id)).length,
    courseCount: courses.length,
    lessonCount: effectiveLessonLists.reduce((total, lessons) => total + lessons.length, 0),
    pendingHomeworkCount: legacyStatistics.pendingHomeworkCount + pendingV3Count,
    completedLessonCount: completionKeys.size,
  };
};
