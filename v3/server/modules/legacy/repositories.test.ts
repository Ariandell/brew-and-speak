import assert from 'node:assert/strict';
import test from 'node:test';
import type { InStatement, ResultSet } from '@libsql/client';
import { createLegacyReadRepositories } from './repositories.js';
import type { ReadOnlyDatabase } from '../../infrastructure/db/readOnlySql.js';

const result = (rows: readonly Record<string, unknown>[]): ResultSet => ({
  columns: [],
  columnTypes: [],
  rows: [...rows] as ResultSet['rows'],
  rowsAffected: 0,
  lastInsertRowid: undefined,
  toJSON: () => ({}),
});

test('legacy user repository normalizes admin to teacher and numeric identity', async () => {
  const queries: InStatement[] = [];
  const database: ReadOnlyDatabase = {
    async execute(statement) {
      queries.push(statement);
      return result([{
        id: 7,
        telegram_id: '777',
        name: 'Teacher',
        username: 'teacher',
        role: 'admin',
        is_blocked: 0,
        enrolled_course_id: 2,
      }]);
    },
  };

  const user = await createLegacyReadRepositories(database).getUserByTelegramId('777');
  assert.deepEqual(user, {
    id: 7,
    telegramId: '777',
    name: 'Teacher',
    username: 'teacher',
    role: 'teacher',
    isBlocked: false,
    enrolledCourseId: 2,
  });
  assert.equal(queries.length, 1);
  assert.match(typeof queries[0] === 'string' ? queries[0] : queries[0].sql, /^SELECT/i);
});

test('legacy lesson repository maps level and block rows without writing', async () => {
  const queries: InStatement[] = [];
  const database: ReadOnlyDatabase = {
    async execute(statement) {
      queries.push(statement);
      const sql = typeof statement === 'string' ? statement : statement.sql;
      if (sql.includes('FROM lessons')) {
        return result([{ id: 11, level_id: 2, title: 'Coffee', lesson_order: 1 }]);
      }
      return result([{ id: 12, type: 'text', content: '{"html":"Hello"}', block_order: 0 }]);
    },
  };

  const lesson = await createLegacyReadRepositories(database).getLesson(11);
  assert.deepEqual(lesson, {
    id: 11,
    courseId: 2,
    title: 'Coffee',
    order: 1,
    blocks: [{ id: 12, type: 'text', rawContent: '{"html":"Hello"}', order: 0 }],
  });
  assert.equal(queries.length, 2);
  assert.ok(queries.every((query) => /^SELECT/i.test(typeof query === 'string' ? query : query.sql)));
});
