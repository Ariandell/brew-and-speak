const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;

export type SrsState = {
  timesShown: number;
  timesCorrect: number;
  timesWrong: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: Date | null;
};

export type SrsReview = SrsState & {
  nextReviewAt: Date;
};

const finiteOr = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;

/** Pure SRS policy. The caller supplies server time and persists the result atomically. */
export const applySrsReview = (state: Partial<SrsState>, correct: boolean, now: Date): SrsReview => {
  const previousInterval = Math.max(0, Math.round(finiteOr(state.intervalDays ?? 0, 0)));
  const previousEase = Math.max(MIN_EASE, finiteOr(state.easeFactor ?? DEFAULT_EASE, DEFAULT_EASE));
  const intervalDays = correct
    ? previousInterval === 0
      ? 1
      : previousInterval === 1
        ? 3
        : Math.max(1, Math.round(previousInterval * previousEase))
    : 0;
  const easeFactor = correct
    ? previousEase + 0.1
    : Math.max(MIN_EASE, previousEase - 0.2);

  return {
    timesShown: Math.max(0, Math.round(finiteOr(state.timesShown ?? 0, 0))) + 1,
    timesCorrect: Math.max(0, Math.round(finiteOr(state.timesCorrect ?? 0, 0))) + (correct ? 1 : 0),
    timesWrong: Math.max(0, Math.round(finiteOr(state.timesWrong ?? 0, 0))) + (correct ? 0 : 1),
    easeFactor,
    intervalDays,
    nextReviewAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
};
