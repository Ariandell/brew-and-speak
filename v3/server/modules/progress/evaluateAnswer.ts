import type { LessonBlock } from '../../../src/api/contracts.js';

/** Grade actual input against a server-owned, frozen block, never client outcome. */
export function evaluateAnswer(block: LessonBlock, answer: unknown): 'correct' | 'wrong' {
  const text = (value: unknown) => typeof value === 'string' ? value.trim() : null;
  let correct = false;
  switch (block.type) {
    case 'quiz': correct = text(answer) === text(block.correctOption); break;
    case 'fill_blank': correct = text(answer) === text(block.correctAnswer); break;
    case 'true_false': correct = typeof answer === 'boolean' && answer === block.correct; break;
    case 'word_order':
      correct = Array.isArray(answer) && answer.length === block.correctOrder.length
        && answer.every((word, index) => text(word) === text(block.correctOrder[index]));
      break;
    case 'match_pairs': {
      if (!Array.isArray(answer) || answer.length !== block.pairs.length) break;
      const remaining = [...block.pairs];
      correct = answer.every((pair: unknown) => {
        if (!pair || typeof pair !== 'object' || !('left' in pair) || !('right' in pair)) return false;
        const index = remaining.findIndex(expected => text(pair.left) === text(expected.left)
          && text(pair.right) === text(expected.right));
        if (index < 0) return false;
        remaining.splice(index, 1);
        return true;
      });
      break;
    }
    default: throw new Error('Block cannot be scored');
  }
  return correct ? 'correct' : 'wrong';
}
