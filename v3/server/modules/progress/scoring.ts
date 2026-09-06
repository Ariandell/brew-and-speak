export type AnswerOutcome = 'correct' | 'wrong';

export type AttemptAnswer = {
  blockId: string;
  outcome: AnswerOutcome;
};

export type LessonScore = {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  score: number;
};

/**
 * Scores a frozen attempt snapshot. Duplicate or unknown answer events never
 * change the result: only the first answer for a scored block is counted.
 */
export const scoreLessonAttempt = (
  scoredBlockIds: readonly string[],
  answers: readonly AttemptAnswer[],
): LessonScore => {
  const scoredIds = [...new Set(scoredBlockIds)];
  const scoredSet = new Set(scoredIds);
  const firstAnswers = new Map<string, AnswerOutcome>();

  for (const answer of answers) {
    if (!scoredSet.has(answer.blockId) || firstAnswers.has(answer.blockId)) continue;
    firstAnswers.set(answer.blockId, answer.outcome);
  }

  const correct = [...firstAnswers.values()].filter((outcome) => outcome === 'correct').length;
  const wrong = firstAnswers.size - correct;
  const total = scoredIds.length;
  const skipped = total - firstAnswers.size;

  return {
    total,
    correct,
    wrong,
    skipped,
    score: total === 0 ? 10 : Math.round((correct / total) * 10),
  };
};
