import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateActivityStreak } from './streak.js';

test('activity streak includes today and consecutive prior UTC days', () => {
  assert.equal(calculateActivityStreak([
    '2026-09-06T22:00:00.000Z', '2026-09-05T01:00:00.000Z',
    '2026-09-04T12:00:00.000Z', '2026-09-02T12:00:00.000Z',
  ], new Date('2026-09-06T23:00:00.000Z')), 3);
});

test('activity streak survives an empty current day but stops at an older gap', () => {
  assert.equal(calculateActivityStreak([
    '2026-09-05T23:59:00.000Z', '2026-09-04T00:01:00.000Z', '2026-09-02T12:00:00.000Z',
  ], new Date('2026-09-06T10:00:00.000Z')), 2);
});

test('activity streak ignores duplicates, malformed values and future activity', () => {
  assert.equal(calculateActivityStreak([
    'broken', null, '2026-09-05T01:00:00.000Z', '2026-09-05T22:00:00.000Z',
    '2026-09-07T00:00:00.000Z',
  ], new Date('2026-09-06T10:00:00.000Z')), 1);
  assert.equal(calculateActivityStreak([], new Date('2026-09-06T10:00:00.000Z')), 0);
});
