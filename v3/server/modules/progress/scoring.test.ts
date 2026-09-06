import { strict as assert } from 'node:assert';
import test from 'node:test';
import { scoreLessonAttempt } from './scoring.js';
import { evaluateAnswer } from './evaluateAnswer.js';

test('grades actual answers for all five task types, preserving commas and repeated words', () => {
  const base = { id: 1, order: 0 };
  const quiz = { ...base, type: 'quiz' as const, question: 'Q', options: ['A', 'B'], correctOption: 'A' };
  assert.equal(evaluateAnswer(quiz, ' A '), 'correct');
  assert.equal(evaluateAnswer(quiz, { outcome: 'correct' }), 'wrong');
  assert.equal(evaluateAnswer({ ...base, type: 'fill_blank', sentence: '___', options: ['Yes, please'], correctAnswer: 'Yes, please' }, 'Yes please'), 'wrong');
  assert.equal(evaluateAnswer({ ...base, type: 'true_false', statement: 'Q', correct: false }, false), 'correct');
  assert.equal(evaluateAnswer({ ...base, type: 'true_false', statement: 'Q', correct: false }, 'false'), 'wrong');
  const order = { ...base, type: 'word_order' as const, words: ['I', 'think', 'I', 'can'], correctOrder: ['I', 'think', 'I', 'can'] };
  assert.equal(evaluateAnswer(order, ['I', 'think', 'I', 'can']), 'correct');
  assert.equal(evaluateAnswer(order, ['I', 'think', 'can']), 'wrong');
  const pairs = { ...base, type: 'match_pairs' as const, pairs: [{ left: 'A', right: 'a' }, { left: 'B', right: 'b' }] };
  assert.equal(evaluateAnswer(pairs, [...pairs.pairs].reverse()), 'correct');
  assert.equal(evaluateAnswer(pairs, [pairs.pairs[0], pairs.pairs[0]]), 'wrong');
  assert.throws(() => evaluateAnswer({ ...base, type: 'text', html: 'Not a test' }, 'x'));
});

test('scores correct, wrong and skipped blocks against the frozen denominator', () => {
  assert.deepEqual(scoreLessonAttempt(['a', 'b', 'c', 'd'], [
    { blockId: 'a', outcome: 'correct' },
    { blockId: 'b', outcome: 'correct' },
    { blockId: 'c', outcome: 'wrong' },
  ]), {
    total: 4,
    correct: 2,
    wrong: 1,
    skipped: 1,
    score: 5,
  });
});

test('does not count duplicate or unknown answer events', () => {
  assert.deepEqual(scoreLessonAttempt(['a', 'b'], [
    { blockId: 'a', outcome: 'wrong' },
    { blockId: 'a', outcome: 'correct' },
    { blockId: 'unknown', outcome: 'correct' },
  ]), {
    total: 2,
    correct: 0,
    wrong: 1,
    skipped: 1,
    score: 0,
  });
});

test('a lesson without scored blocks can complete with full score', () => {
  assert.deepEqual(scoreLessonAttempt([], []), {
    total: 0,
    correct: 0,
    wrong: 0,
    skipped: 0,
    score: 10,
  });
});
