import { strict as assert } from 'node:assert';
import { createHmac } from 'node:crypto';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxTeacherApp } from '../../createSandboxTeacherApp.js';
import { createReadOnlyDatabase } from '../../infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxCourseSchema } from '../courses/sandboxCourseRepository.js';
import { initializeSandboxHomeworkSchema } from '../homework/sandboxHomeworkRepository.js';
import { initializeSandboxAttemptSchema } from '../progress/sandboxAttemptRepository.js';
import { initializeSandboxLessonSchema } from '../lessons/sandboxLessonRepository.js';
import { initializeSandboxStudentControlSchema } from './sandboxStudentControlRepository.js';
import { initializeSandboxLessonDraftSchema } from './sandboxLessonDraftRepository.js';
import { getEffectiveTeacherStatistics } from './effectiveStatistics.js';

const botToken = 'effective-statistics-test-token';
const teacherInitData = (): string => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000) - 30),
    user: JSON.stringify({ id: 9, first_name: 'Teacher' }),
  });
  const checkString = [...params.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
};

test('effective teacher statistics merge additive V3 rows without double-counting legacy completions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-effective-statistics-'));
  const path = join(root, 'database.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await database.batch([
      `CREATE TABLE users (id INTEGER PRIMARY KEY, telegram_id TEXT, name TEXT, username TEXT,
        role TEXT, is_blocked INTEGER, enrolled_course_id INTEGER)`,
      `CREATE TABLE levels (id INTEGER PRIMARY KEY, title TEXT, description TEXT, "order" INTEGER)`,
      `CREATE TABLE lessons (id INTEGER PRIMARY KEY, level_id INTEGER, title TEXT, "order" INTEGER)`,
      `CREATE TABLE lesson_blocks (id INTEGER PRIMARY KEY, lesson_id INTEGER, type TEXT, content TEXT, "order" INTEGER)`,
      `CREATE TABLE homework_submissions (id INTEGER PRIMARY KEY, status TEXT)`,
      `CREATE TABLE user_progress (id INTEGER PRIMARY KEY, user_id INTEGER, lesson_id INTEGER, status TEXT)`,
    ]);
    await Promise.all([
      initializeSandboxCourseSchema(database),
      initializeSandboxHomeworkSchema(database),
      initializeSandboxAttemptSchema(database),
      initializeSandboxLessonSchema(database),
      initializeSandboxLessonDraftSchema(database),
      initializeSandboxStudentControlSchema(database),
    ]);
    await database.batch([
      { sql: `INSERT INTO users VALUES (7, '7', 'One', NULL, 'student', 0, 2),
        (8, '8', 'Two', NULL, 'student', 1, 2), (9, '9', 'Teacher', NULL, 'teacher', 0, NULL)`, args: [] },
      { sql: `INSERT INTO levels VALUES (2, 'Active', '', 1), (3, 'Archived', '', 2)`, args: [] },
      { sql: `INSERT INTO lessons VALUES (10, 2, 'A', 1), (11, 2, 'B', 2)`, args: [] },
      { sql: `INSERT INTO homework_submissions VALUES (1, 'pending'), (2, 'graded')`, args: [] },
      { sql: `INSERT INTO user_progress VALUES (1, 7, 10, 'completed')`, args: [] },
      { sql: `INSERT INTO v3_courses VALUES (100000, 'V3 course', '', 3)`, args: [] },
      { sql: `INSERT INTO v3_course_overrides VALUES (3, 'Archived', '', 2, 1)`, args: [] },
      { sql: `INSERT INTO v3_student_controls VALUES (7, 1, 9, '2026-08-01T00:00:00.000Z'),
        (8, 0, 9, '2026-08-01T00:00:00.000Z')`, args: [] },
      { sql: `INSERT INTO v3_homework_submissions VALUES
        ('pending-v3', 7, 10, '', 'pending', NULL, NULL, '2026-08-01T00:00:00.000Z', NULL),
        ('graded-v3', 8, 11, '', 'graded', 9, '', '2026-08-01T00:00:00.000Z', '2026-08-02T00:00:00.000Z')`, args: [] },
      { sql: `INSERT INTO v3_attempts VALUES
        ('duplicate', 7, 10, 'legacy', 'finished', 10, 1, 0, 0, '2026-08-01T00:00:00.000Z', '2026-08-01T00:01:00.000Z'),
        ('new', 8, 11, 'legacy', 'finished', 8, 1, 0, 0, '2026-08-01T00:00:00.000Z', '2026-08-01T00:01:00.000Z')`, args: [] },
    ]);

    const readDatabase = createReadOnlyDatabase({ url: `file:${path}` });
    const statistics = await getEffectiveTeacherStatistics(readDatabase, database);
    assert.deepEqual(statistics, {
      studentCount: 2,
      blockedStudentCount: 2,
      courseCount: 2,
      lessonCount: 2,
      pendingHomeworkCount: 2,
      completedLessonCount: 2,
    });

    const server = createSandboxTeacherApp({
      readDatabase, writeDatabase: database, writeDatabaseUrl: `file:${path}`, botToken,
      schemaReady: Promise.resolve(),
    }).listen(0);
    try {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      const response = await fetch(`http://127.0.0.1:${address.port}/api/v2/sandbox/teacher/statistics`, {
        headers: { 'X-Telegram-Init-Data': teacherInitData() },
      });
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).item, statistics);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
