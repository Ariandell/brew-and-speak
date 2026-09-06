import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import type { LegacyCoursePathRecord } from '../legacy/repositories.js';
import { listEffectiveLessonSummaries } from '../lessons/sandboxLessonRepository.js';

/** Overlay completed V3 attempts without mutating inherited progress. */
export async function effectiveCoursePathRecords(
  database: SandboxWriteDatabase, userId: number, legacy: readonly LegacyCoursePathRecord[],
  options?: { courseId: number },
): Promise<LegacyCoursePathRecord[]> {
  let records = legacy.map(record => ({ ...record }));
  if (options) {
    const summaries = await listEffectiveLessonSummaries(database, options.courseId, legacy.map((record) => ({
      id: record.lessonId,
      title: record.title,
      order: record.order,
      blockCount: 0,
      hasHomework: record.hasHomework,
    })));
    const legacyById = new Map(legacy.map((record) => [record.lessonId, record]));
    records = summaries.map((summary) => {
      const inherited = legacyById.get(summary.id);
      return inherited
        ? { ...inherited, title: summary.title, order: summary.order, hasHomework: summary.hasHomework }
        : {
          lessonId: summary.id,
          title: summary.title,
          order: summary.order,
          status: null,
          unlocksAt: null,
          completedAt: null,
          score: null,
          homeworkStatus: null,
          homeworkGrade: null,
          hasHomework: summary.hasHomework,
        };
    });
    const homework = await database.execute({
      sql: `SELECT lesson_id, status, grade FROM v3_homework_submissions
        WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      args: [userId],
    });
    const latestByLesson = new Map<number, Record<string, unknown>>();
    for (const raw of homework.rows) {
      const row = raw as unknown as Record<string, unknown>;
      const lessonId = Number(row.lesson_id);
      if (!latestByLesson.has(lessonId)) latestByLesson.set(lessonId, row);
    }
    records = records.map((record) => {
      const submission = latestByLesson.get(record.lessonId);
      return submission ? {
        ...record,
        homeworkStatus: submission.status === 'graded' ? 'graded' : 'pending',
        homeworkGrade: submission.grade === null || submission.grade === undefined ? null : Number(submission.grade),
      } : record;
    });
  }
  const inheritedCompletion = new Map(records.map((record) => [record.lessonId, record.completedAt]));
  const result = await database.execute({
    sql: `SELECT lesson_id, finished_at, score
      FROM v3_attempts WHERE user_id = ? AND status = 'finished' AND finished_at IS NOT NULL
      ORDER BY finished_at, id`,
    args: [userId],
  });
  const completions = new Map<number, { first: string; latest: string; score: number | null }>();
  for (const row of result.rows) {
    const lessonId = Number(row.lesson_id);
    const finishedAt = String(row.finished_at);
    const current = completions.get(lessonId);
    completions.set(lessonId, { first: current?.first ?? finishedAt, latest: finishedAt,
      score: row.score === null || row.score === undefined ? null : Number(row.score) });
  }
  records = records.map(record => {
    const completed = completions.get(record.lessonId);
    if (!completed) return { ...record };
    const latest = record.completedAt && Date.parse(record.completedAt) > Date.parse(completed.latest)
      ? record.completedAt : completed.latest;
    return { ...record, status: 'completed', completedAt: latest,
      score: latest === completed.latest ? completed.score : record.score ?? null };
  });
  for (let index = 1; index < records.length; index++) {
    const previous = records[index - 1];
    const current = records[index];
    if (previous.status !== 'completed' || current.status === 'completed' || current.status === 'unlocked') continue;
    const first = completions.get(previous.lessonId)?.first;
    const inherited = inheritedCompletion.get(previous.lessonId) ?? null;
    const timestamps = [first, inherited].filter((value): value is string => Boolean(value))
      .map(Date.parse).filter(Number.isFinite);
    if (!timestamps.length) continue;
    const unlock = Math.min(...timestamps) + 24 * 60 * 60 * 1000;
    // Repeating a completed lesson must not postpone a previously granted unlock.
    if (!current.unlocksAt || Date.parse(current.unlocksAt) > unlock) {
      current.unlocksAt = new Date(unlock).toISOString();
    }
  }
  return records;
}
