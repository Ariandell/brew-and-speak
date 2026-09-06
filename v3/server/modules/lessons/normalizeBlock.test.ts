import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLessonBlock } from './normalizeBlock.js';
import type { LegacyLessonBlock } from '../legacy/repositories.js';

const block = (type: string, content: unknown): LegacyLessonBlock => ({
  id: 1,
  type,
  rawContent: JSON.stringify(content),
  order: 0,
});

test('normalizes legacy content and removes HTML attributes', () => {
  const result = normalizeLessonBlock(block('text', {
    body: '<p>Hello <strong class="unsafe" onclick="bad()">world</strong><img src="x" onerror="bad()"></p>',
  }));

  assert.equal(result.type, 'text');
  if (result.type === 'text') {
    assert.equal(result.html, '<p>Hello <strong>world</strong></p>');
  }
});

test('maps legacy exercise shapes into canonical blocks', () => {
  const result = normalizeLessonBlock(block('quiz', {
    question: 'Choose one',
    options: [{ label: 'wrong', isCorrect: false }, { label: 'right', isCorrect: true }],
  }));
  assert.deepEqual(result, {
    id: 1,
    order: 0,
    type: 'quiz',
    question: 'Choose one',
    options: ['wrong', 'right'],
    correctOption: 'right',
  });
});

test('keeps malformed legacy content visible as unsupported instead of hiding it', () => {
  const result = normalizeLessonBlock(block('fill_blank', {
    sentence: 'I ___ coffee',
    answer: 'drink',
    options: ['am', 'is'],
  }));

  assert.equal(result.type, 'unsupported');
  if (result.type === 'unsupported') assert.match(result.reason, /fill_blank/i);
});

