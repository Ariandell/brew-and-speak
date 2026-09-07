import type { InStatement } from '@libsql/client';
import type { LessonBlock } from '../../../src/api/contracts.js';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import type { LegacyLesson, LegacyLessonSummary } from '../legacy/repositories.js';
import { normalizeLessonBlocks } from './normalizeBlock.js';
import { getSandboxLessonDraft } from '../teacher/sandboxLessonDraftRepository.js';
import { vocabularySchemaSql } from '../teacher/lessonVocabularyRepository.js';

export type EffectiveLesson = {
  id: number;
  courseId: number;
  title: string;
  order: number;
  contentRevision: string;
  blocks: readonly LessonBlock[];
  origin: 'legacy' | 'v3';
};

export class LessonDeleteConflictError extends Error {
  constructor() {
    super('Lesson has linked learning data');
    this.name = 'LessonDeleteConflictError';
  }
}

export const lessonSchemaStatements: readonly InStatement[] = [
  `CREATE TABLE IF NOT EXISTS v3_lessons (
    id INTEGER PRIMARY KEY,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    lesson_order INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS v3_lesson_overrides (
    lesson_id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    lesson_order INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1))
  )`,
  'CREATE INDEX IF NOT EXISTS v3_lessons_course_order_idx ON v3_lessons(course_id, lesson_order, id)',
];

const numberValue = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);
const stringValue = (value: unknown): string => typeof value === 'string' ? value : '';

export const initializeSandboxLessonSchema = async (database: SandboxWriteDatabase): Promise<void> => {
  await database.batch([...lessonSchemaStatements, vocabularySchemaSql]);
};

const getNewLessonRow = async (database: SandboxWriteDatabase, lessonId: number) => {
  const result = await database.execute({
    sql: 'SELECT id, course_id, title, lesson_order FROM v3_lessons WHERE id = ?', args: [lessonId],
  });
  return result.rows[0] as unknown as Record<string, unknown> | undefined;
};

const getOverrideRow = async (database: SandboxWriteDatabase, lessonId: number) => {
  const result = await database.execute({
    sql: 'SELECT lesson_id, title, lesson_order, archived FROM v3_lesson_overrides WHERE lesson_id = ?', args: [lessonId],
  });
  return result.rows[0] as unknown as Record<string, unknown> | undefined;
};

export const getEffectiveLesson = async (
  database: SandboxWriteDatabase,
  lessonId: number,
  legacyLesson: LegacyLesson | null,
): Promise<EffectiveLesson | null> => {
  const [created, override, draft] = await Promise.all([
    getNewLessonRow(database, lessonId),
    getOverrideRow(database, lessonId),
    getSandboxLessonDraft(database, lessonId),
  ]);
  if (!created && legacyLesson && legacyLesson.id !== lessonId) {
    throw new Error('Legacy lesson identity mismatch');
  }
  if (override && numberValue(override.archived) === 1) return null;
  if (!created && !legacyLesson) return null;
  const origin = created ? 'v3' as const : 'legacy' as const;
  const title = override ? stringValue(override.title) : created ? stringValue(created.title) : legacyLesson!.title;
  const order = override ? numberValue(override.lesson_order) : created ? numberValue(created.lesson_order) : legacyLesson!.order;
  const blocks = draft?.blocks ?? (legacyLesson ? normalizeLessonBlocks(legacyLesson.blocks) : []);
  return {
    id: lessonId,
    courseId: created ? numberValue(created.course_id) : legacyLesson!.courseId,
    title,
    order,
    contentRevision: draft ? `draft-${draft.contentRevision}` : `${origin}-${lessonId}`,
    blocks,
    origin,
  };
};

export const listEffectiveLessonSummaries = async (
  database: SandboxWriteDatabase,
  courseId: number,
  legacyLessons: readonly LegacyLessonSummary[],
): Promise<readonly LegacyLessonSummary[]> => {
  const created = await database.execute({
    sql: 'SELECT id, title, lesson_order FROM v3_lessons WHERE course_id = ? ORDER BY lesson_order, id', args: [courseId],
  });
  const overrides = await database.execute('SELECT lesson_id, title, lesson_order, archived FROM v3_lesson_overrides');
  const overrideById = new Map(overrides.rows.map((raw) => {
    const row = raw as unknown as Record<string, unknown>;
    return [numberValue(row.lesson_id), row] as const;
  }));
  const summaries = new Map<number, LegacyLessonSummary>();
  for (const lesson of legacyLessons) {
    const override = overrideById.get(lesson.id);
    if (override && numberValue(override.archived) === 1) continue;
    summaries.set(lesson.id, {
      ...lesson,
      title: override ? stringValue(override.title) : lesson.title,
      order: override ? numberValue(override.lesson_order) : lesson.order,
    });
  }
  for (const raw of created.rows) {
    const row = raw as unknown as Record<string, unknown>;
    const id = numberValue(row.id);
    const override = overrideById.get(id);
    if (override && numberValue(override.archived) === 1) continue;
    summaries.set(id, {
      id,
      title: override ? stringValue(override.title) : stringValue(row.title),
      order: override ? numberValue(override.lesson_order) : numberValue(row.lesson_order),
      blockCount: 0,
      hasHomework: false,
    });
  }
  const effective = await Promise.all([...summaries.values()].map(async (summary) => {
    const draft = await getSandboxLessonDraft(database, summary.id);
    if (!draft) return summary;
    return {
      ...summary,
      blockCount: draft.blocks.length,
      hasHomework: draft.blocks.some((block) => block.type === 'homework'),
    };
  }));
  return effective.sort((left, right) => left.order - right.order || left.id - right.id);
};

export const createSandboxLesson = async (
  database: SandboxWriteDatabase,
  input: { courseId: number; title: string; order: number },
): Promise<EffectiveLesson> => {
  const result = await database.execute({
    sql: `INSERT INTO v3_lessons (id, course_id, title, lesson_order)
      SELECT MAX(1000000, COALESCE(MAX(id), 999999) + 1), ?, ?, ? FROM v3_lessons RETURNING id`,
    args: [input.courseId, input.title, input.order],
  });
  const id = numberValue((result.rows[0] as unknown as Record<string, unknown> | undefined)?.id);
  if (!id) throw new Error('Lesson was not created');
  return { id, courseId: input.courseId, title: input.title, order: input.order,
    contentRevision: `v3-${id}`, blocks: [], origin: 'v3' };
};

export const updateSandboxLesson = async (
  database: SandboxWriteDatabase,
  lesson: EffectiveLesson,
  input: { title?: string; order?: number },
): Promise<EffectiveLesson> => {
  const title = input.title ?? lesson.title;
  const order = input.order ?? lesson.order;
  if (lesson.origin === 'v3') {
    const result = await database.execute({
      sql: 'UPDATE v3_lessons SET title = ?, lesson_order = ? WHERE id = ?', args: [title, order, lesson.id],
    });
    if (result.rowsAffected !== 1) throw new Error('V3 lesson disappeared during update');
  } else {
    await database.execute({
      sql: `INSERT INTO v3_lesson_overrides (lesson_id, title, lesson_order, archived)
        VALUES (?, ?, ?, 0) ON CONFLICT(lesson_id) DO UPDATE SET
          title = excluded.title, lesson_order = excluded.lesson_order, archived = 0`,
      args: [lesson.id, title, order],
    });
  }
  return { ...lesson, title, order };
};

const noLinkedDataSql = `NOT EXISTS (SELECT 1 FROM user_progress WHERE lesson_id = ?) AND
  NOT EXISTS (SELECT 1 FROM homework_submissions WHERE lesson_id = ?) AND
  NOT EXISTS (SELECT 1 FROM flashcards WHERE lesson_id = ?) AND
  NOT EXISTS (SELECT 1 FROM v3_lesson_vocabulary WHERE lesson_id = ? AND json_array_length(items_json) > 0) AND
  NOT EXISTS (SELECT 1 FROM v3_attempts WHERE lesson_id = ?) AND
  NOT EXISTS (SELECT 1 FROM v3_homework_submissions WHERE lesson_id = ?)`;

const linkArgs = (lessonId: number) => [lessonId, lessonId, lessonId, lessonId, lessonId, lessonId];

export const deleteSandboxLesson = async (
  database: SandboxWriteDatabase,
  lesson: EffectiveLesson,
): Promise<void> => {
  if (lesson.origin === 'legacy') {
    const result = await database.execute({
      sql: `INSERT INTO v3_lesson_overrides (lesson_id, title, lesson_order, archived)
        SELECT ?, ?, ?, 1 WHERE ${noLinkedDataSql}
        ON CONFLICT(lesson_id) DO UPDATE SET archived = 1`,
      args: [lesson.id, lesson.title, lesson.order, ...linkArgs(lesson.id)],
    });
    if (result.rowsAffected !== 1) throw new LessonDeleteConflictError();
    return;
  }
  const results = await database.batch([
    { sql: `DELETE FROM v3_lessons WHERE id = ? AND ${noLinkedDataSql}`,
      args: [lesson.id, ...linkArgs(lesson.id)] },
    { sql: 'DELETE FROM v3_lesson_drafts WHERE lesson_id = ? AND NOT EXISTS (SELECT 1 FROM v3_lessons WHERE id = ?)',
      args: [lesson.id, lesson.id] },
  ]);
  if (results[0].rowsAffected !== 1) throw new LessonDeleteConflictError();
};
