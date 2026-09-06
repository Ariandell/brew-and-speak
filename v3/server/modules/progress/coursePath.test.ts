import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveCoursePath } from './coursePath.js';
import type { LegacyCoursePathRecord, LegacyUser } from '../legacy/repositories.js';

const student: LegacyUser = {
  id: 1,
  telegramId: '1',
  name: 'Student',
  username: null,
  role: 'student',
  isBlocked: false,
  enrolledCourseId: 2,
};

const records: LegacyCoursePathRecord[] = [
  {
    lessonId: 10,
    title: 'First',
    order: 1,
    status: null,
    unlocksAt: null,
    completedAt: null,
    homeworkStatus: null,
    homeworkGrade: null,
    hasHomework: false,
  },
  {
    lessonId: 11,
    title: 'Second',
    order: 2,
    status: null,
    unlocksAt: '2026-08-18T12:00:00.000Z',
    completedAt: null,
    homeworkStatus: 'pending',
    homeworkGrade: null,
    hasHomework: true,
  },
];

test('course path opens only the first lesson for a new student', () => {
  const path = deriveCoursePath(student, records, new Date('2026-08-17T12:00:00.000Z'));
  assert.deepEqual(path.items.map((item) => item.status), ['available', 'locked']);
  assert.equal(path.items[1].homework.status, 'pending');
});

test('course path derives the next lesson as available after unlock time', () => {
  const path = deriveCoursePath({ ...student }, [
    { ...records[0], status: 'completed', completedAt: '2026-08-17T11:00:00.000Z' },
    records[1],
  ], new Date('2026-08-18T12:00:00.000Z'));
  assert.deepEqual(path.items.map((item) => item.status), ['completed', 'available']);
});

test('teacher preview opens locked lessons without creating progress', () => {
  const path = deriveCoursePath({ ...student, role: 'teacher' }, records, new Date('2026-08-17T12:00:00.000Z'));
  assert.deepEqual(path.items.map((item) => item.status), ['available', 'available']);
  assert.equal(path.items[1].unlocksAt, null);
});
