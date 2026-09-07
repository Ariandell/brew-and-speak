import type { ReadOnlyDatabase } from '../../infrastructure/db/readOnlySql.js';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import type { LegacyFlashcard, LegacyUser } from '../legacy/repositories.js';
import { createLegacyReadRepositories } from '../legacy/repositories.js';
import { deriveCoursePath } from '../progress/coursePath.js';
import { effectiveCoursePathRecords } from '../progress/effectiveCoursePath.js';

const num = (value: unknown, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export const canonicalSrsDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const source = value.trim();
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(source)
    ? `${source.replace(' ', 'T')}Z`
    : source;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
};

export async function listEffectiveFlashcards(
  readDatabase: ReadOnlyDatabase, writeDatabase: SandboxWriteDatabase, user: LegacyUser,
  courseId: number, limit: number | null = null,
): Promise<LegacyFlashcard[]> {
  const repositories = createLegacyReadRepositories(readDatabase);
  const records = await effectiveCoursePathRecords(writeDatabase, user.id,
    await repositories.getCoursePath(courseId, user.id), { courseId });
  const path = deriveCoursePath({ ...user, enrolledCourseId: courseId }, records);
  const lessonIds = path.items.filter(item => item.status !== 'locked').map(item => item.lessonId);
  if (!lessonIds.length) return [];
  const placeholders = lessonIds.map(() => '?').join(',');
  const result = await readDatabase.execute({
    sql: `SELECT f.id, f.lesson_id, f.word, f.translation, f.example_phrase, lessons.title AS lesson_title,
      COALESCE(progress.times_shown, 0) AS times_shown, COALESCE(progress.times_correct, 0) AS times_correct,
      COALESCE(progress.times_wrong, 0) AS times_wrong, COALESCE(progress.ease_factor, 2.5) AS ease_factor,
      COALESCE(progress.interval_days, 0) AS interval_days, progress.next_review_at
      FROM flashcards f JOIN lessons ON lessons.id = f.lesson_id
      LEFT JOIN user_flashcard_progress progress ON progress.flashcard_id = f.id AND progress.user_id = ?
      WHERE f.lesson_id IN (${placeholders}) ORDER BY lessons."order", f.id`,
    // The progress key precedes the IN arguments in SQL.
    args: [user.telegramId, ...lessonIds],
  });
  const vocabulary = await writeDatabase.execute({
    sql: `SELECT lesson_id, items_json FROM v3_lesson_vocabulary WHERE lesson_id IN (${placeholders})`, args: lessonIds,
  });
  const overridden = new Set(vocabulary.rows.map(row => num(row.lesson_id)));
  const effectiveRows: Record<string, unknown>[] = result.rows.filter(row => !overridden.has(num(row.lesson_id)));
  const legacyById = new Map(result.rows.map(row => [num(row.id), row]));
  for (const row of vocabulary.rows) {
    const lessonId = num(row.lesson_id);
    const title = path.items.find(item => item.lessonId === lessonId)?.title ?? '';
    const items = JSON.parse(String(row.items_json)) as Array<{ id: number; front: string; back: string }>;
    for (const item of items) effectiveRows.push({ ...legacyById.get(item.id), id: item.id, lesson_id: lessonId,
      lesson_title: title, word: item.front, translation: item.back });
  }
  const ids = effectiveRows.map(row => num(row.id));
  const overlay = ids.length ? await writeDatabase.execute({
    sql: `SELECT flashcard_id, times_shown, times_correct, times_wrong, ease_factor, interval_days, next_review_at
      FROM v3_flashcard_progress WHERE user_id = ? AND flashcard_id IN (${ids.map(() => '?').join(',')})`,
    args: [user.id, ...ids],
  }) : { rows: [] };
  const byId = new Map(overlay.rows.map(row => [num(row.flashcard_id), row]));
  const cards = effectiveRows.map(row => {
    const progress = byId.get(num(row.id)) ?? row;
    return {
      id: num(row.id), lessonId: num(row.lesson_id), lessonTitle: String(row.lesson_title ?? ''),
      front: String(row.word ?? ''), back: String(row.translation ?? ''),
      examplePhrase: typeof row.example_phrase === 'string' ? row.example_phrase : null,
      timesShown: Math.max(0, num(progress.times_shown)), timesCorrect: Math.max(0, num(progress.times_correct)),
      timesWrong: Math.max(0, num(progress.times_wrong)), easeFactor: Math.max(1.3, num(progress.ease_factor, 2.5)),
      intervalDays: Math.max(0, num(progress.interval_days)),
      nextReviewAt: canonicalSrsDate(progress.next_review_at),
    } satisfies LegacyFlashcard;
  });
  const now = Date.now();
  cards.sort((a, b) => {
    const rank = (card: LegacyFlashcard) => card.timesShown === 0 ? 0
      : card.nextReviewAt === null || Date.parse(card.nextReviewAt) <= now ? 1 : 2;
    return rank(a) - rank(b) || a.lessonId - b.lessonId || a.id - b.id;
  });
  return limit === null ? cards : cards.slice(0, Math.max(1, Math.min(20, Math.trunc(limit))));
}
