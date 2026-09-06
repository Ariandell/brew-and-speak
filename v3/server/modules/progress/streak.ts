const DAY_MS = 24 * 60 * 60 * 1000;

const utcDay = (value: Date): number => Date.UTC(
  value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(),
);

/**
 * Counts consecutive UTC activity days. An empty current day does not erase a
 * streak earned through yesterday; any older gap does. Future/invalid values
 * are ignored so malformed inherited data cannot inflate the result.
 */
export const calculateActivityStreak = (
  activityTimestamps: readonly (string | null | undefined)[],
  now: Date = new Date(),
): number => {
  const today = utcDay(now);
  const days = new Set<number>();
  for (const timestamp of activityTimestamps) {
    if (!timestamp) continue;
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) continue;
    const day = utcDay(parsed);
    if (day <= today) days.add(day);
  }
  let cursor = days.has(today) ? today : today - DAY_MS;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
};
