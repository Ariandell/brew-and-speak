import { lessonBlockSchema, type LessonBlock } from '../../../src/api/contracts.js';
import { sanitizeRichText } from './normalizeBlock.js';

export type DraftValidationIssue = {
  path: string;
  message: string;
};

export class LessonDraftValidationError extends Error {
  constructor(readonly issues: readonly DraftValidationIssue[]) {
    super('Lesson draft is invalid');
    this.name = 'LessonDraftValidationError';
  }
}

const sanitizeBlock = (block: LessonBlock): LessonBlock => {
  if (block.type === 'text') return { ...block, html: sanitizeRichText(block.html) };
  if (block.type === 'mascot_tip') return { ...block, html: sanitizeRichText(block.html) };
  if (block.type === 'homework') return { ...block, promptHtml: sanitizeRichText(block.promptHtml) };
  return block;
};

const multiset = (values: readonly string[]): Map<string, number> => {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
};

const sameMultiset = (left: Map<string, number>, right: Map<string, number>): boolean => (
  left.size === right.size && [...left].every(([value, count]) => right.get(value) === count)
);

export const validateLessonDraft = (input: unknown): readonly LessonBlock[] => {
  const issues: DraftValidationIssue[] = [];
  if (!Array.isArray(input)) {
    throw new LessonDraftValidationError([{ path: 'blocks', message: 'Blocks must be an array' }]);
  }

  const parsed = input.map((block, index) => {
    const result = lessonBlockSchema.safeParse(block);
    if (!result.success) {
      issues.push({ path: `blocks.${index}`, message: 'Block does not match the API contract' });
      return null;
    }
    return sanitizeBlock(result.data);
  });

  const blocks = parsed.filter((block): block is LessonBlock => block !== null);
  const ids = new Set<number>();
  const orders = new Set<number>();
  blocks.forEach((block, index) => {
    if (ids.has(block.id)) issues.push({ path: `blocks.${index}.id`, message: 'Block IDs must be unique' });
    ids.add(block.id);
    if (orders.has(block.order)) issues.push({ path: `blocks.${index}.order`, message: 'Block orders must be unique' });
    orders.add(block.order);
    if (block.type === 'unsupported') issues.push({ path: `blocks.${index}`, message: 'Unsupported legacy block cannot be saved from the editor' });
    if (block.type === 'quiz') {
      if (new Set(block.options.map((option) => option.trim())).size !== block.options.length) {
        issues.push({ path: `blocks.${index}.options`, message: 'Quiz options must be unique' });
      }
      if (!block.options.some((option) => option.trim() === block.correctOption.trim())) {
        issues.push({ path: `blocks.${index}.correctOption`, message: 'Correct quiz option must exist in options' });
      }
    }
    if (block.type === 'fill_blank') {
      if (!/_+/.test(block.sentence)) issues.push({ path: `blocks.${index}.sentence`, message: 'Fill blank sentence needs an underscore gap' });
      if (!block.options.some((option) => option.trim() === block.correctAnswer.trim())) {
        issues.push({ path: `blocks.${index}.correctAnswer`, message: 'Correct answer must exist in options' });
      }
    }
    if (block.type === 'word_order') {
      if (!sameMultiset(multiset(block.words), multiset(block.correctOrder))) {
        issues.push({ path: `blocks.${index}`, message: 'Word order must use exactly the provided words' });
      }
    }
  });

  if (issues.length > 0) throw new LessonDraftValidationError(issues);
  return blocks.sort((left, right) => left.order - right.order);
};
