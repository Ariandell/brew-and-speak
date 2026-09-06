const RETAKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type RetakeDecision = {
  allowed: boolean;
  retryAt: Date | null;
  reason: 'teacher_preview' | 'never_completed' | 'cooldown' | 'available';
};

export const decideRetake = (
  lastCompletedAt: string | Date | null,
  now: Date,
  isTeacher: boolean,
): RetakeDecision => {
  if (isTeacher) return { allowed: true, retryAt: null, reason: 'teacher_preview' };
  if (!lastCompletedAt) return { allowed: true, retryAt: null, reason: 'never_completed' };

  const completedAt = lastCompletedAt instanceof Date
    ? lastCompletedAt.getTime()
    : Date.parse(lastCompletedAt);
  if (Number.isNaN(completedAt)) {
    return { allowed: false, retryAt: null, reason: 'cooldown' };
  }

  const retryAt = new Date(completedAt + RETAKE_COOLDOWN_MS);
  return now.getTime() >= retryAt.getTime()
    ? { allowed: true, retryAt, reason: 'available' }
    : { allowed: false, retryAt, reason: 'cooldown' };
};
