import sanitizeHtml from 'sanitize-html';
import { lessonBlockSchema, type LessonBlock } from '../../../src/api/contracts.js';
import type { LegacyLessonBlock } from '../legacy/repositories.js';

export class ContentInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentInvalidError';
  }
}

const allowedTags = ['div', 'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'blockquote'];

export const sanitizeRichText = (value: unknown): string => {
  const raw = typeof value === 'string' ? value : '';
  // Legacy plain text and contentEditable divs carry meaningful line breaks.
  // Newlines remain meaningful even inside a legacy <p>; browsers otherwise collapse them.
  const html = (/<\/?[a-z][^>]*>/i.test(raw) ? raw : raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    .replace(/\r?\n/g, '<br>');
  return sanitizeHtml(
  html,
  {
    allowedTags,
    allowedAttributes: {},
    allowedSchemes: [],
  },
);
};

const objectContent = (block: LegacyLessonBlock): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(block.rawContent);
  } catch {
    throw new ContentInvalidError(`Block ${block.id} has invalid JSON content`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ContentInvalidError(`Block ${block.id} content is not an object`);
  }
  return parsed as Record<string, unknown>;
};

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

const assetId = (value: unknown): string => {
  const source = text(value);
  const match = /^\/api\/assets\/([^/?#]+)(?:[?#].*)?$/.exec(source);
  if (!match) return source;
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
};

const stringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.map(text).filter(Boolean)
  : [];

const options = (value: unknown): Array<{ label: string; isCorrect: boolean }> => {
  if (!Array.isArray(value)) return [];
  return value.map((option) => {
    if (typeof option === 'string') return { label: option.trim(), isCorrect: false };
    if (!option || typeof option !== 'object') return { label: '', isCorrect: false };
    const row = option as Record<string, unknown>;
    return {
      label: text(row.label ?? row.value),
      isCorrect: row.isCorrect === true,
    };
  }).filter((option) => option.label.length > 0);
};

const mascotMood = (value: unknown): 'neutral' | 'happy' | 'perfect' | 'sad' | 'surprised' => {
  const mood = text(value);
  // The original editor stored the resting pose as `idle`; V3 calls the same
  // expression `neutral`. Treat it as a vocabulary rename, not broken content.
  if (mood === 'idle' || mood === '') return 'neutral';
  return ['neutral', 'happy', 'perfect', 'sad', 'surprised'].includes(mood)
    ? mood as 'neutral' | 'happy' | 'perfect' | 'sad' | 'surprised'
    : 'neutral';
};

const sentenceWithGap = (value: unknown): string => {
  const sentence = text(value);
  if (/_+/.test(sentence) || !sentence) return sentence;
  // A few records created by the legacy editor omitted the visual underscore
  // while keeping the missing word after the first subject. The old UI still
  // rendered them as choices; restore the marker V3 needs to render the gap.
  return sentence.replace(/^(\S+)(\s+)/, '$1 ___$2');
};

const normalizedBlock = (block: LegacyLessonBlock, content: Record<string, unknown>): unknown => {
  switch (block.type) {
    case 'text':
      return { ...block, type: 'text', html: sanitizeRichText(content.body ?? content.text) };
    case 'audio':
      return {
        ...block,
        type: 'audio',
        assetId: assetId(content.assetId ?? content.audioUrl),
        title: text(content.caption) || undefined,
      };
    case 'photo':
      return {
        ...block,
        type: 'photo',
        assetId: assetId(content.assetId ?? content.imageUrl),
        alt: text(content.alt ?? content.caption),
      };
    case 'mascot_tip':
      return {
        ...block,
        type: 'mascot_tip',
        html: sanitizeRichText(content.text),
        mood: mascotMood(content.mood),
      };
    case 'quiz': {
      const quizOptions = options(content.options);
      const correct = quizOptions.find((option) => option.isCorrect)?.label
        ?? text(content.correctAnswer ?? content.answer);
      if (!correct || !quizOptions.some((option) => option.label.trim() === correct.trim())) {
        throw new ContentInvalidError(`Block ${block.id} has no correct quiz option`);
      }
      return {
        ...block,
        type: 'quiz',
        question: text(content.question),
        options: quizOptions.map((option) => option.label),
        correctOption: correct,
      };
    }
    case 'fill_blank':
      {
        const fillOptions = stringArray(content.options);
        const correctAnswer = text(content.correctAnswer ?? content.answer);
        const sentence = sentenceWithGap(content.sentence);
        if (!/_+/.test(sentence) || !correctAnswer || !fillOptions.some((option) => option.trim() === correctAnswer.trim())) {
          throw new ContentInvalidError(`Block ${block.id} has an invalid fill_blank answer`);
        }
        return {
        ...block,
        type: 'fill_blank',
          sentence,
          options: fillOptions,
          correctAnswer,
        };
      }
    case 'true_false':
      return {
        ...block,
        type: 'true_false',
        statement: text(content.statement),
        correct: content.correct === true || content.isTrue === true,
      };
    case 'word_order': {
      const correctOrder = text(content.sentence).split(/\s+/).filter(Boolean);
      return {
        ...block,
        type: 'word_order',
        words: stringArray(content.words).length > 0 ? stringArray(content.words) : [...correctOrder].sort(),
        correctOrder,
      };
    }
    case 'match_pairs':
      return {
        ...block,
        type: 'match_pairs',
        pairs: Array.isArray(content.pairs)
          ? content.pairs.map((pair) => {
            const row = pair && typeof pair === 'object' ? pair as Record<string, unknown> : {};
            return { left: text(row.left ?? row.word), right: text(row.right ?? row.translation) };
          }).filter((pair) => pair.left && pair.right)
          : [],
      };
    case 'homework':
      return { ...block, type: 'homework', promptHtml: sanitizeRichText(content.prompt ?? content.body) };
    default:
      throw new ContentInvalidError(`Block ${block.id} has unsupported type ${block.type}`);
  }
};

export const normalizeLessonBlock = (block: LegacyLessonBlock): LessonBlock => {
  try {
    const content = objectContent(block);
    return lessonBlockSchema.parse(normalizedBlock(block, content));
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown content error';
    return lessonBlockSchema.parse({
      id: block.id,
      order: block.order,
      type: 'unsupported',
      reason,
    });
  }
};

export const normalizeLessonBlocks = (blocks: readonly LegacyLessonBlock[]): LessonBlock[] => (
  blocks.map(normalizeLessonBlock)
);
