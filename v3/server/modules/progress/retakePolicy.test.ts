import { strict as assert } from 'node:assert';
import test from 'node:test';
import { decideRetake } from './retakePolicy.js';

const completedAt = '2026-08-16T12:00:00.000Z';

test('retake remains blocked before the 24-hour boundary', () => {
  const decision = decideRetake(completedAt, new Date('2026-08-17T11:59:59.999Z'), false);
  assert.equal(decision.allowed, false);
  assert.equal(decision.reason, 'cooldown');
  assert.equal(decision.retryAt?.toISOString(), '2026-08-17T12:00:00.000Z');
});

test('retake opens exactly at 24 hours and remains open afterwards', () => {
  const decision = decideRetake(completedAt, new Date('2026-08-17T12:00:00.000Z'), false);
  assert.equal(decision.allowed, true);
  assert.equal(decision.reason, 'available');
});

test('teacher preview bypasses cooldown without creating a retry timestamp', () => {
  const decision = decideRetake(completedAt, new Date('2026-08-16T12:01:00.000Z'), true);
  assert.deepEqual(decision, { allowed: true, retryAt: null, reason: 'teacher_preview' });
});
