import { createHmac } from 'node:crypto';
import { strict as assert } from 'node:assert';
import { mkdtemp, unlink } from 'node:fs/promises';
import type { InStatement, ResultSet } from '@libsql/client';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxHomeworkApp } from './createSandboxHomeworkApp.js';
import type { ReadOnlyDatabase } from './infrastructure/db/readOnlySql.js';
import { createSandboxWriteDatabase } from './infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxHomeworkSchema } from './modules/homework/sandboxHomeworkRepository.js';
import { createSandboxLesson, initializeSandboxLessonSchema } from './modules/lessons/sandboxLessonRepository.js';
import { initializeSandboxLessonDraftSchema, saveSandboxLessonDraft } from './modules/teacher/sandboxLessonDraftRepository.js';

const token = 'sandbox-homework-test-token';
const signedInitData = (): string => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000) - 30),
    user: JSON.stringify({ id: 42, first_name: 'User', username: 'user' }),
  });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secretKey).update(checkString).digest('hex'));
  return params.toString();
};

const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [], columnTypes: [], rows: [...rows] as ResultSet['rows'], rowsAffected: 0,
  lastInsertRowid: undefined, toJSON: () => ({}),
});

const fakeReadDatabase = (role: 'student' | 'teacher'): ReadOnlyDatabase => ({
  async execute(statement: InStatement) {
    const sql = typeof statement === 'string' ? statement : statement.sql;
    if (sql.includes('FROM users')) return result([{
      id: role === 'student' ? 7 : 9, telegram_id: '42', name: 'User', username: 'user', role,
      is_blocked: 0, enrolled_course_id: 2,
    }]);
    if (sql.includes('FROM lessons WHERE id')) return result([{ id: 10, level_id: 2, title: 'Coffee', lesson_order: 1 }]);
    if (sql.includes('FROM lesson_blocks WHERE lesson_id')) return result([{
      id: 100, type: 'homework', content: JSON.stringify({ prompt: '<p>Write about coffee</p>' }), block_order: 0,
    }]);
    return result([]);
  },
});

const startServer = (role: 'student' | 'teacher', database: ReturnType<typeof createSandboxWriteDatabase>) => {
  const server = createSandboxHomeworkApp({
    readDatabase: fakeReadDatabase(role), writeDatabase: database, writeDatabaseUrl: 'file:sandbox.sqlite', botToken: token,
  }).listen(0);
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
};

test('sandbox homework API submits sanitized answer and teacher grades it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-homework-api-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  await initializeSandboxHomeworkSchema(database);
  const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
  const student = startServer('student', database);
  try {
    const submit = await fetch(`${student.baseUrl}/api/v2/sandbox/lessons/10/homework`, {
      method: 'POST', headers,
      body: JSON.stringify({
        submissionId: 'submission-1', answerHtml: '<p>My <script>bad()</script> answer</p>', assets: [],
      }),
    });
    assert.equal(submit.status, 201);
    const submitted = await submit.json();
    assert.equal(submitted.answerHtml, '<p>My  answer</p>');

    const list = await fetch(`${student.baseUrl}/api/v2/sandbox/me/homework`, { headers });
    assert.equal(list.status, 200);
    assert.equal((await list.json()).items.length, 1);
  } finally {
    await new Promise<void>((resolve, reject) => student.server.close((error) => error ? reject(error) : resolve()));
  }

  const teacher = startServer('teacher', database);
  try {
    const teacherList = await fetch(`${teacher.baseUrl}/api/v2/sandbox/teacher/homework?status=pending`, { headers });
    assert.equal(teacherList.status, 200);
    assert.equal((await teacherList.json()).items[0].submissionId, 'submission-1');

    const grade = await fetch(`${teacher.baseUrl}/api/v2/sandbox/teacher/homework/submission-1/grade`, {
      method: 'POST', headers,
      body: JSON.stringify({ grade: 8, teacherComment: '<b>Good</b>' }),
    });
    assert.equal(grade.status, 200);
    const graded = await grade.json();
    assert.equal(graded.status, 'graded');
    assert.equal(graded.grade, 8);
    assert.equal(graded.teacherComment, '<b>Good</b>');
  } finally {
    await new Promise<void>((resolve, reject) => teacher.server.close((error) => error ? reject(error) : resolve()));
    const studentAfterGrade = startServer('student', database);
    try {
      const homeworkAfterGrade = await fetch(`${studentAfterGrade.baseUrl}/api/v2/sandbox/me/homework`, { headers });
      assert.equal(homeworkAfterGrade.status, 200);
      const homeworkBody = await homeworkAfterGrade.json();
      assert.equal(homeworkBody.items[0].status, 'graded');
      assert.equal(homeworkBody.items[0].grade, 8);
    } finally {
      await new Promise<void>((resolve, reject) => studentAfterGrade.server.close((error) => error ? reject(error) : resolve()));
    }
    database.close();
    await unlink(path).catch(() => undefined);
  }
});

test('sandbox homework API blocks teacher submit', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-homework-auth-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  await initializeSandboxHomeworkSchema(database);
  const server = startServer('teacher', database);
  try {
    const response = await fetch(`${server.baseUrl}/api/v2/sandbox/lessons/10/homework`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() },
      body: JSON.stringify({ submissionId: 'teacher-submission', answerHtml: 'bad', assets: [] }),
    });
    assert.equal(response.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.server.close((error) => error ? reject(error) : resolve()));
    database.close();
    await unlink(path).catch(() => undefined);
  }
});

test('homework reads and submissions use the effective content of a new V3 lesson', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-v3-homework-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  await Promise.all([
    initializeSandboxHomeworkSchema(database),
    initializeSandboxLessonSchema(database),
    initializeSandboxLessonDraftSchema(database),
  ]);
  const lesson = await createSandboxLesson(database, { courseId: 2, title: 'V3 homework', order: 0 });
  await saveSandboxLessonDraft(database, {
    lessonId: lesson.id, expectedRevision: 0, updatedBy: 9, updatedAt: new Date().toISOString(),
    blocks: [{ id: 401, order: 0, type: 'homework', promptHtml: '<p>Effective prompt</p>' }],
  });
  const server = startServer('student', database);
  const headers = { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': signedInitData() };
  try {
    const prompt = await fetch(`${server.baseUrl}/api/v2/sandbox/lessons/${lesson.id}/homework`, { headers });
    assert.equal(prompt.status, 200);
    assert.equal((await prompt.json()).promptHtml, '<p>Effective prompt</p>');
    const submit = await fetch(`${server.baseUrl}/api/v2/sandbox/lessons/${lesson.id}/homework`, {
      method: 'POST', headers,
      body: JSON.stringify({ submissionId: 'v3-homework', answerHtml: '<p>Answer</p>', assets: [] }),
    });
    assert.equal(submit.status, 201);
    assert.equal((await submit.json()).lessonId, lesson.id);
  } finally {
    await new Promise<void>((resolve, reject) => server.server.close((error) => error ? reject(error) : resolve()));
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
