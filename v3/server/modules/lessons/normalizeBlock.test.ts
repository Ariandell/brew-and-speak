import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLessonBlock, sanitizeRichText } from './normalizeBlock.js';
import type { LegacyLessonBlock } from '../legacy/repositories.js';

const block = (type: string, content: unknown): LegacyLessonBlock => ({
  id: 1,
  type,
  rawContent: JSON.stringify(content),
  order: 0,
});

test('preserves legacy plain text lines and contentEditable paragraph boundaries', () => {
  assert.equal(sanitizeRichText('happy — щасливий\nexcited — схвильований'), 'happy — щасливий<br />excited — схвильований');
  assert.equal(sanitizeRichText('<p>Вона встає.\nВона п’є каву.\nДля осіб I, You, We, They</p>'), '<p>Вона встає.<br />Вона п’є каву.<br />Для осіб I, You, We, They</p>');
  assert.equal(sanitizeRichText('First<div>Second</div><div><br></div><div><u>Third</u></div>'), 'First<div>Second</div><div><br /></div><div><u>Third</u></div>');
  assert.equal(sanitizeRichText('<div onclick="bad()">Safe<script>bad()</script></div>'), '<div>Safe</div>');
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

test('repairs legacy idle mascot tips and fill blanks without a rendered gap marker', () => {
  const tip = normalizeLessonBlock(block('mascot_tip', { text: 'Keep going', mood: 'idle' }));
  assert.equal(tip.type, 'mascot_tip');
  if (tip.type === 'mascot_tip') assert.equal(tip.mood, 'neutral');

  const fill = normalizeLessonBlock(block('fill_blank', {
    sentence: 'We for the update.',
    answer: 'had been waiting',
    options: ['had been waiting', 'have waited'],
  }));
  assert.equal(fill.type, 'fill_blank');
  if (fill.type === 'fill_blank') {
    assert.equal(fill.sentence, 'We ___ for the update.');
    assert.equal(fill.correctAnswer, 'had been waiting');
  }
});

test('extracts canonical asset ids from legacy media URLs', () => {
  const audio = normalizeLessonBlock(block('audio', { audioUrl: '/api/assets/voice%20one?cache=1' }));
  const photo = normalizeLessonBlock(block('photo', { imageUrl: '/api/assets/photo-one', alt: 'Photo' }));
  assert.equal(audio.type, 'audio');
  if (audio.type === 'audio') assert.equal(audio.assetId, 'voice one');
  assert.equal(photo.type, 'photo');
  if (photo.type === 'photo') assert.equal(photo.assetId, 'photo-one');
});
