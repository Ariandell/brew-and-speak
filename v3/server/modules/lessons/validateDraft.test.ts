import { strict as assert } from 'node:assert';
import test from 'node:test';
import { LessonDraftValidationError, validateLessonDraft } from './validateDraft.js';

const block = (overrides: Record<string, unknown> = {}) => ({
  id: 1, order: 0, type: 'text', html: '<p>Hello <a href="javascript:alert(1)">world</a></p>', ...overrides,
});

test('sanitizes editor rich text and returns ordered blocks', () => {
  const result = validateLessonDraft([
    block({ id: 2, order: 1 }),
    block({ id: 1, order: 0 }),
  ]);
  assert.deepEqual(result.map((item) => item.order), [0, 1]);
  assert.equal(result[0].type, 'text');
  if (result[0].type === 'text') assert.equal(result[0].html, '<p>Hello world</p>');
});

test('rejects unsupported, duplicate and semantically invalid blocks', () => {
  assert.throws(() => validateLessonDraft([
    block({ id: 1 }),
    block({ id: 1, order: 0 }),
    { id: 3, order: 1, type: 'unsupported', reason: 'legacy' },
    {
      id: 4, order: 2, type: 'fill_blank', sentence: 'I like coffee', options: ['tea'], correctAnswer: 'coffee',
    },
  ]), (error: unknown) => {
    assert.ok(error instanceof LessonDraftValidationError);
    assert.ok(error.issues.length >= 4);
    return true;
  });
});

test('rejects a word order draft with a changed word multiset', () => {
  assert.throws(() => validateLessonDraft([{
    id: 1, order: 0, type: 'word_order', words: ['I', 'brew'], correctOrder: ['I', 'drink'],
  }]), /Lesson draft is invalid/);
});
