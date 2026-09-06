import { strict as assert } from 'node:assert';
import test from 'node:test';
import { applySrsReview } from './srs.js';

const now = new Date('2026-08-17T12:34:56.000Z');

test('SRS follows 0 → 1 → 3 → multiplied interval', () => {
  const first = applySrsReview({}, true, now);
  const second = applySrsReview(first, true, now);
  const third = applySrsReview(second, true, now);
  const fourth = applySrsReview(third, true, now);

  assert.equal(first.intervalDays, 1);
  assert.equal(second.intervalDays, 3);
  assert.equal(third.intervalDays, 8);
  assert.equal(fourth.intervalDays, 22);
  assert.equal(fourth.nextReviewAt.toISOString(), '2026-09-08T12:34:56.000Z');
});

test('wrong resets interval and never lowers ease below 1.3', () => {
  const result = applySrsReview({
    timesShown: 4,
    timesCorrect: 3,
    timesWrong: 1,
    easeFactor: 1.3,
    intervalDays: 30,
  }, false, now);

  assert.equal(result.intervalDays, 0);
  assert.equal(result.easeFactor, 1.3);
  assert.equal(result.timesShown, 5);
  assert.equal(result.timesWrong, 2);
  assert.equal(result.nextReviewAt.toISOString(), now.toISOString());
});

test('review date is calculated from supplied server time, not local timezone', () => {
  const result = applySrsReview({}, true, new Date('2026-12-31T23:59:59.000Z'));
  assert.equal(result.nextReviewAt.toISOString(), '2027-01-01T23:59:59.000Z');
});
