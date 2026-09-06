import { createHmac } from 'node:crypto';
import type { InStatement, ResultSet } from '@libsql/client';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createApp } from './createApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';

const token = 'integration-test-bot-token';
const now = Math.floor(Date.now() / 1000);

const signedInitData = (): string => {
  const params = new URLSearchParams({
    auth_date: String(now - 60),
    user: JSON.stringify({ id: 42, first_name: 'Student', username: 'student' }),
  });
  const checkString = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secretKey).update(checkString).digest('hex'));
  return params.toString();
};

const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [],
  columnTypes: [],
  rows: [...rows] as ResultSet['rows'],
  rowsAffected: 0,
  lastInsertRowid: undefined,
  toJSON: () => ({}),
});

const fakeDatabase = (role: 'student' | 'teacher' = 'student'): ReadOnlyDatabase => ({
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (sql.includes("COUNT(*) AS count FROM users WHERE role = 'student' AND")) return result([{ count: 1 }]);
    if (sql.includes("COUNT(*) AS count FROM users WHERE role = 'student'")) return result([{ count: 1 }]);
    if (sql.includes('COUNT(*) AS count FROM levels')) return result([{ count: 1 }]);
    if (sql.includes('COUNT(*) AS count FROM lessons')) return result([{ count: 2 }]);
    if (sql.includes("WHERE role = 'student'")) {
      return result([{
        id: 7,
        telegram_id: 'student-7',
        name: 'Second Student',
        username: 'second_student',
        role: 'student',
        is_blocked: 0,
        enrolled_course_id: 2,
      }]);
    }
    if (sql.includes('FROM users WHERE id = ?')) {
      return result([{
        id: 7,
        telegram_id: 'student-7',
        name: 'Second Student',
        username: 'second_student',
        role: 'student',
        is_blocked: 0,
        enrolled_course_id: 2,
      }]);
    }
    if (sql.includes('COUNT(*) AS count FROM user_progress')) return result([{ count: 3 }]);
    if (sql.includes('AVG(score)')) return result([{ average_score: 8.5 }]);
    if (sql.includes('COUNT(*) AS count FROM homework_submissions')) return result([{ count: 1 }]);
    if (sql.includes('SELECT lesson_blocks.content FROM lesson_blocks')) {
      return result([{ content: JSON.stringify({ assetId: 'asset-1' }) }]);
    }
    if (sql.includes('FROM app_assets')) return result([{ id: 'asset-1', mime_type: 'image/png', data: 'aGVsbG8=' }]);
    if (sql.includes('SELECT id, user_id, lesson_id') || sql.includes('FROM homework_submissions h')) return result([{
      id: 900, user_id: 1, lesson_id: 10, answer_text: '<p>Answer <script>bad()</script></p>', file_url: null, file_name: null,
      submitted_at: '2026-08-17T10:00:00.000Z', updated_at: '2026-08-17T10:05:00.000Z', grade: 80, feedback: 'Good', status: 'graded',
    }]);
    if (sql.includes('FROM users')) {
      return result([{
        id: 1,
        telegram_id: '42',
        name: 'Student',
        username: 'student',
        role,
        is_blocked: 0,
        enrolled_course_id: 2,
      }]);
    }
    if (sql.includes('FROM levels')) {
      return result([{ id: 2, title: 'English', description: 'Course', course_order: 1, lesson_count: 2 }]);
    }
    if (sql.includes('LEFT JOIN lesson_blocks')) {
      return result([{ id: 10, title: 'Coffee', lesson_order: 1, block_count: 1, has_homework: 0 }]);
    }
    if (sql.includes('FROM flashcards')) {
      return result([{
        id: 500, lesson_id: 10, word: 'brew', translation: 'заварювати', example_phrase: 'Brew coffee',
        lesson_title: 'Coffee', times_shown: 0, times_correct: 0, times_wrong: 0,
        ease_factor: 2.5, interval_days: 0, next_review_at: null,
      }]);
    }
    if (sql.includes('SELECT DISTINCT lesson_id')) return result([]);
    if (sql.includes('FROM user_progress') || sql.includes('FROM homework_submissions')) return result([]);
    if (sql.includes('FROM lesson_blocks')) {
      return result([{ id: 100, type: 'text', content: JSON.stringify({ body: '<p>Hello</p>' }), block_order: 0 }]);
    }
    if (sql.includes('FROM lessons WHERE id')) {
      return result([{ id: 10, level_id: 2, title: 'Coffee', lesson_order: 1 }]);
    }
    if (sql.includes('FROM lessons WHERE level_id')) {
      return result([
        { id: 10, title: 'Coffee', lesson_order: 1 },
        { id: 11, title: 'Tea', lesson_order: 2 },
      ]);
    }
    return result([]);
  },
});

test('read-only student flow authenticates and reads path and lesson', async () => {
  const server = createApp({ database: fakeDatabase(), botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const headers = { 'X-Telegram-Init-Data': signedInitData() };

    const me = await fetch(`${baseUrl}/api/v2/me`, { headers });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).role, 'student');

    const path = await fetch(`${baseUrl}/api/v2/me/course/path`, { headers });
    assert.equal(path.status, 200);
    const pathBody = await path.json();
    assert.equal(pathBody.items[0].status, 'available');
    assert.equal(pathBody.items[1].status, 'locked');

    const lesson = await fetch(`${baseUrl}/api/v2/lessons/10`, { headers });
    assert.equal(lesson.status, 200);
    const lessonBody = await lesson.json();
    assert.equal(lessonBody.blocks[0].html, '<p>Hello</p>');

    const dictionary = await fetch(`${baseUrl}/api/v2/me/dictionary`, { headers });
    assert.equal(dictionary.status, 200);
    assert.equal((await dictionary.json()).items[0].front, 'brew');

    const studySession = await fetch(`${baseUrl}/api/v2/me/study-session?limit=1`, { headers });
    assert.equal(studySession.status, 200);
    assert.equal((await studySession.json()).items.length, 1);

    const courses = await fetch(`${baseUrl}/api/v2/courses`, { headers });
    assert.equal(courses.status, 200);
    assert.equal((await courses.json()).items[0].courseId, 2);

    const course = await fetch(`${baseUrl}/api/v2/me/course`, { headers });
    assert.equal(course.status, 200);
    assert.equal((await course.json()).course.courseId, 2);

    const asset = await fetch(`${baseUrl}/api/v2/assets/asset-1`, { headers });
    assert.equal(asset.status, 200);
    assert.equal(asset.headers.get('content-type'), 'image/png');
    assert.equal(Buffer.from(await asset.arrayBuffer()).toString(), 'hello');

    const studentHomework = await fetch(`${baseUrl}/api/v2/me/homework`, { headers });
    assert.equal(studentHomework.status, 200);
    assert.equal((await studentHomework.json()).items[0].status, 'graded');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('teacher can read the workspace while student is denied', async () => {
  const teacherServer = createApp({ database: fakeDatabase('teacher'), botToken: token }).listen(0);
  const studentServer = createApp({ database: fakeDatabase('student'), botToken: token }).listen(0);
  try {
    const teacherAddress = teacherServer.address();
    const studentAddress = studentServer.address();
    assert.ok(teacherAddress && typeof teacherAddress !== 'string');
    assert.ok(studentAddress && typeof studentAddress !== 'string');
    const headers = { 'X-Telegram-Init-Data': signedInitData() };

    const teacherCourses = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/courses`, { headers });
    assert.equal(teacherCourses.status, 200);
    assert.equal((await teacherCourses.json()).items[0].lessonCount, 2);

    const teacherLessons = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/courses/2/lessons`, { headers });
    assert.equal(teacherLessons.status, 200);
    assert.equal((await teacherLessons.json()).items[0].blockCount, 1);

    const teacherLesson = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/lessons/10`, { headers });
    assert.equal(teacherLesson.status, 200);

    const students = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/students`, { headers });
    assert.equal(students.status, 200);
    assert.equal((await students.json()).items[0].studentId, 7);

    const studentDetails = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/students/7`, { headers });
    assert.equal(studentDetails.status, 200);
    const studentDetailsBody = await studentDetails.json();
    assert.equal(studentDetailsBody.item.completedLessons, 3);
    assert.equal(studentDetailsBody.item.averageScore, 8.5);

    const invalidStudent = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/students/nope`, { headers });
    assert.equal(invalidStudent.status, 400);

    const studentCourses = await fetch(`http://127.0.0.1:${studentAddress.port}/api/v2/teacher/courses`, { headers });
    assert.equal(studentCourses.status, 403);

    const studentList = await fetch(`http://127.0.0.1:${studentAddress.port}/api/v2/teacher/students`, { headers });
    assert.equal(studentList.status, 403);

    const statistics = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/statistics`, { headers });
    assert.equal(statistics.status, 200);
    assert.equal((await statistics.json()).item.studentCount, 1);

    const teacherHomework = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/homework?status=graded`, { headers });
    assert.equal(teacherHomework.status, 200);
    assert.equal((await teacherHomework.json()).items[0].submissionId, '900');
    const teacherHomeworkDetails = await fetch(`http://127.0.0.1:${teacherAddress.port}/api/v2/teacher/homework/900`, { headers });
    assert.equal(teacherHomeworkDetails.status, 200);
    assert.equal((await teacherHomeworkDetails.json()).answerHtml, '<p>Answer </p>');
  } finally {
    await Promise.all([
      new Promise<void>((resolve, reject) => teacherServer.close((error) => error ? reject(error) : resolve())),
      new Promise<void>((resolve, reject) => studentServer.close((error) => error ? reject(error) : resolve())),
    ]);
  }
});

test('unknown API routes return the stable JSON error contract', async () => {
  const server = createApp({ database: fakeDatabase(), botToken: token }).listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v2/does-not-exist`);
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.code, 'NOT_FOUND');
    assert.equal(body.message, 'API-маршрут не знайдено');
    assert.equal(typeof body.requestId, 'string');
    assert.ok(body.requestId.length > 0);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
