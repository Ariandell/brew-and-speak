import { createHmac } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createProductionApp } from '../createProductionApp.js';
import { createReadOnlyDatabase } from '../infrastructure/db/readOnlySql.js';

const databasePath = process.env.LEGACY_SQLITE_PATH ?? resolve(process.cwd(), '../server/database.sqlite');
if (!existsSync(databasePath)) throw new Error(`Legacy SQLite file does not exist: ${databasePath}`);

const token = 'english-with-coffee-legacy-read-audit';
const database = createReadOnlyDatabase({ url: `file:${databasePath}` });
const app = createProductionApp({ readDatabase: database, botToken: token, writesEnabled: false });
const server = app.listen(0, '127.0.0.1');
await new Promise<void>((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});

type User = { id: number; telegramId: string; role: 'student' | 'teacher'; blocked: boolean; courseId: number | null };
type Check = { userId: number; role: User['role']; path: string; expected: readonly number[]; actual: number; code?: string; message?: string };

const signed = (telegramId: string) => {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: Number(telegramId), first_name: 'Legacy audit' }),
  });
  const check = [...params.entries()].sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return { 'X-Telegram-Init-Data': params.toString() };
};

const rows = await database.execute({
  sql: `SELECT id, telegram_id, role, is_blocked, enrolled_course_id FROM users
    WHERE telegram_id GLOB '[0-9]*' ORDER BY id`, args: [],
});
const users: User[] = rows.rows.map(row => ({
  id: Number(row.id),
  telegramId: String(row.telegram_id),
  role: row.role === 'teacher' || row.role === 'admin' ? 'teacher' : 'student',
  blocked: Number(row.is_blocked) === 1,
  courseId: typeof row.enrolled_course_id === 'number' ? row.enrolled_course_id : null,
}));

const address = server.address();
if (!address || typeof address === 'string') throw new Error('Legacy audit server did not start');
const base = `http://127.0.0.1:${address.port}`;
const checks: Check[] = [];

const get = async <T>(user: User, path: string, expected: readonly number[] = [200]): Promise<T | null> => {
  const response = await fetch(`${base}/api/v2${path}`, { headers: signed(user.telegramId) });
  let body: unknown = null;
  try { body = await response.json(); } catch { /* Binary assets and empty bodies are valid. */ }
  const error = body && typeof body === 'object' ? body as Record<string, unknown> : null;
  checks.push({ userId: user.id, role: user.role, path, expected, actual: response.status,
    code: typeof error?.code === 'string' ? error.code : undefined,
    message: typeof error?.message === 'string' ? error.message : undefined });
  return expected.includes(response.status) && response.status === 200 ? body as T : null;
};

try {
  for (const user of users) {
    await get(user, '/me');
    if (user.blocked) continue;

    if (user.role === 'student') {
      await Promise.all([
        get(user, '/me/streak'), get(user, '/courses'), get(user, '/me/chat'), get(user, '/me/photo-messages'),
      ]);
      if (user.courseId === null) continue;
      const [, path] = await Promise.all([
        get(user, '/me/course'),
        get<{ items?: Array<{ lessonId: number; status: string; homework?: { hasHomework?: boolean } }> }>(user, '/me/course/path'),
        get(user, '/me/homework'), get(user, '/me/dictionary'), get(user, '/me/study-session?limit=20'),
      ]);
      for (const lesson of path?.items ?? []) {
        if (lesson.status === 'locked') continue;
        const detail = await get<{ blocks?: Array<{ type: string; assetId?: string }> }>(user, `/lessons/${lesson.lessonId}`);
        for (const block of detail?.blocks ?? []) {
          if ((block.type === 'audio' || block.type === 'photo') && block.assetId) {
            await get(user, `/assets/${encodeURIComponent(block.assetId)}`);
          }
        }
        if (lesson.homework?.hasHomework) await get(user, `/lessons/${lesson.lessonId}/homework`);
      }
      continue;
    }

    const [courses, homework, students, conversations] = await Promise.all([
      get<{ items?: Array<{ courseId: number }> }>(user, '/teacher/courses'),
      get<{ items?: Array<{ submissionId: string }> }>(user, '/teacher/homework'),
      get<{ items?: Array<{ studentId: number }> }>(user, '/teacher/students'),
      get<{ items?: Array<{ studentUserId: number }> }>(user, '/teacher/chat/conversations'),
      get(user, '/teacher/homework?status=pending'), get(user, '/teacher/homework?status=graded'),
      get(user, '/teacher/statistics'), get(user, '/teacher/photo-messages'),
    ]);
    for (const course of courses?.items ?? []) {
      const lessons = await get<{ items?: Array<{ lessonId: number }> }>(user, `/teacher/courses/${course.courseId}/lessons`);
      for (const lesson of lessons?.items ?? []) await get(user, `/teacher/lessons/${lesson.lessonId}`);
    }
    for (const item of homework?.items ?? []) await get(user, `/teacher/homework/${encodeURIComponent(item.submissionId)}`);
    for (const student of students?.items ?? []) await get(user, `/teacher/students/${student.studentId}`);
    for (const item of conversations?.items ?? []) await get(user, `/teacher/chat/conversations/${item.studentUserId}`);
  }

  const teacher = users.find(user => user.role === 'teacher' && !user.blocked);
  if (teacher) {
    const assets = await database.execute({ sql: 'SELECT id FROM app_assets ORDER BY id', args: [] });
    for (const asset of assets.rows) await get(teacher, `/assets/${encodeURIComponent(String(asset.id))}`);
  }

  const failures = checks.filter(check => !check.expected.includes(check.actual));
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    databasePath,
    usersAudited: users.length,
    checks: checks.length,
    statusCounts: Object.fromEntries([...new Set(checks.map(check => check.actual))].sort()
      .map(status => [status, checks.filter(check => check.actual === status).length])),
    failures,
  }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
