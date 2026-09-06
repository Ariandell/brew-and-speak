import type { InArgs } from '@libsql/client';
import type { Role } from '../../../src/api/contracts.js';
import type { ReadOnlyDatabase } from '../../infrastructure/db/readOnlySql.js';

type LegacyRow = Record<string, unknown>;

export type LegacyUser = {
  id: number;
  telegramId: string;
  name: string;
  username: string | null;
  role: Role;
  isBlocked: boolean;
  enrolledCourseId: number | null;
};

export type LegacyCourse = {
  id: number;
  title: string;
  description: string;
  order: number;
  lessonCount: number;
};

export type LegacyLessonSummary = {
  id: number;
  title: string;
  order: number;
  blockCount: number;
  hasHomework: boolean;
};

export type LegacyLesson = {
  id: number;
  courseId: number;
  title: string;
  order: number;
  blocks: readonly LegacyLessonBlock[];
};

export type LegacyLessonBlock = {
  id: number;
  type: string;
  rawContent: string;
  order: number;
};

export type LegacyCoursePathRecord = {
  lessonId: number;
  title: string;
  order: number;
  status: string | null;
  unlocksAt: string | null;
  completedAt: string | null;
  score?: number | null;
  homeworkStatus: string | null;
  homeworkGrade: number | null;
  hasHomework: boolean;
};

export type LegacyFlashcard = {
  id: number;
  lessonId: number;
  lessonTitle: string;
  front: string;
  back: string;
  examplePhrase: string | null;
  timesShown: number;
  timesCorrect: number;
  timesWrong: number;
  easeFactor: number;
  intervalDays: number;
  nextReviewAt: string | null;
};

export type LegacyStudentOverview = {
  user: LegacyUser;
  completedLessons: number;
  totalLessons: number;
  averageScore: number | null;
  pendingHomework: number;
};

export type LegacyTeacherStatistics = {
  studentCount: number;
  blockedStudentCount: number;
  courseCount: number;
  lessonCount: number;
  pendingHomeworkCount: number;
  completedLessonCount: number;
};

export type LegacyAsset = {
  id: string;
  mimeType: string;
  base64Data: string;
};

export type LegacyHomeworkSubmission = {
  id: number;
  userId: number;
  lessonId: number;
  answerText: string;
  fileUrl: string | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string | null;
  grade: number | null;
  feedback: string | null;
  status: 'pending' | 'graded';
};

const rowsOf = async (database: ReadOnlyDatabase, sql: string, args: InArgs): Promise<readonly LegacyRow[]> => {
  const result = await database.execute({ sql, args });
  return result.rows as unknown as readonly LegacyRow[];
};

const requiredNumber = (row: LegacyRow, key: string): number => {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`Legacy row has invalid numeric field: ${key}`);
  }
  return value;
};

const optionalNumber = (row: LegacyRow, key: string): number | null => {
  const value = row[key];
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
};

const stringValue = (row: LegacyRow, key: string, fallback = ''): string => {
  const value = row[key];
  return typeof value === 'string' ? value : fallback;
};

const roleValue = (row: LegacyRow): Role => {
  const role = row.role;
  return role === 'teacher' || role === 'admin' ? 'teacher' : 'student';
};

const userFromRow = (row: LegacyRow): LegacyUser => ({
  id: requiredNumber(row, 'id'),
  telegramId: stringValue(row, 'telegram_id'),
  name: stringValue(row, 'name', 'Telegram user'),
  username: typeof row.username === 'string' ? row.username : null,
  role: roleValue(row),
  isBlocked: Number(row.is_blocked) === 1,
  enrolledCourseId: optionalNumber(row, 'enrolled_course_id'),
});

const courseFromRow = (row: LegacyRow): LegacyCourse => ({
  id: requiredNumber(row, 'id'),
  title: stringValue(row, 'title'),
  description: stringValue(row, 'description'),
  order: requiredNumber(row, 'course_order'),
  lessonCount: requiredNumber(row, 'lesson_count'),
});

const lessonFromRow = (row: LegacyRow, blocks: readonly LegacyLessonBlock[]): LegacyLesson => ({
  id: requiredNumber(row, 'id'),
  courseId: requiredNumber(row, 'level_id'),
  title: stringValue(row, 'title'),
  order: requiredNumber(row, 'lesson_order'),
  blocks,
});

const blockFromRow = (row: LegacyRow): LegacyLessonBlock => ({
  id: requiredNumber(row, 'id'),
  type: stringValue(row, 'type'),
  rawContent: stringValue(row, 'content'),
  order: requiredNumber(row, 'block_order'),
});

const nullableString = (row: LegacyRow, key: string): string | null => (
  typeof row[key] === 'string' ? row[key] as string : null
);

const nullableNumber = (row: LegacyRow, key: string): number | null => (
  typeof row[key] === 'number' && Number.isInteger(row[key]) ? row[key] as number : null
);

// The legacy teacher UI stored and displayed homework grades on a 0..100
// scale. V3 uses a single 0..10 contract. Convert only while reading legacy
// rows; additive V3 grades are already 0..10 and never pass through here.
const legacyGradeToTenPoint = (row: LegacyRow): number | null => {
  const grade = nullableNumber(row, 'grade');
  if (grade === null) return null;
  return Math.max(0, Math.min(10, Math.round(grade / 10)));
};

const homeworkFromRow = (row: LegacyRow): LegacyHomeworkSubmission => ({
  id: requiredNumber(row, 'id'),
  userId: requiredNumber(row, 'user_id'),
  lessonId: requiredNumber(row, 'lesson_id'),
  answerText: stringValue(row, 'answer_text'),
  fileUrl: nullableString(row, 'file_url'),
  fileName: nullableString(row, 'file_name'),
  createdAt: stringValue(row, 'submitted_at', new Date(0).toISOString()),
  updatedAt: nullableString(row, 'updated_at'),
  grade: legacyGradeToTenPoint(row),
  feedback: nullableString(row, 'feedback'),
  status: row.status === 'graded' || row.grade !== null && row.grade !== undefined ? 'graded' : 'pending',
});

export const createLegacyReadRepositories = (database: ReadOnlyDatabase) => ({
  async getUserByTelegramId(telegramId: string): Promise<LegacyUser | null> {
    const rows = await rowsOf(database,
      'SELECT id, telegram_id, name, username, role, is_blocked, enrolled_course_id FROM users WHERE telegram_id = ? LIMIT 1',
      [telegramId]);
    return rows[0] ? userFromRow(rows[0]) : null;
  },

  async getUserById(userId: number): Promise<LegacyUser | null> {
    const rows = await rowsOf(database,
      'SELECT id, telegram_id, name, username, role, is_blocked, enrolled_course_id FROM users WHERE id = ? LIMIT 1',
      [userId]);
    return rows[0] ? userFromRow(rows[0]) : null;
  },

  async getTeacher(): Promise<LegacyUser | null> {
    const rows = await rowsOf(database,
      "SELECT id, telegram_id, name, username, role, is_blocked, enrolled_course_id FROM users WHERE role IN ('teacher', 'admin') ORDER BY id LIMIT 1",
      []);
    return rows[0] ? userFromRow(rows[0]) : null;
  },

  async listStudents(): Promise<readonly LegacyUser[]> {
    const rows = await rowsOf(database,
      "SELECT id, telegram_id, name, username, role, is_blocked, enrolled_course_id FROM users WHERE role = 'student' ORDER BY name, id",
      []);
    return rows.map(userFromRow);
  },

  async getCourseById(courseId: number): Promise<LegacyCourse | null> {
    const course = (await this.listCourses()).find((item) => item.id === courseId);
    return course ?? null;
  },

  async getTeacherStatistics(): Promise<LegacyTeacherStatistics> {
    const count = async (sql: string, args: InArgs = []): Promise<number> => {
      const rows = await rowsOf(database, sql, args);
      const value = rows[0]?.count;
      return Math.max(0, Math.round(typeof value === 'number' ? value : Number(value ?? 0)));
    };
    const [studentCount, blockedStudentCount, courseCount, lessonCount, pendingHomeworkCount, completedLessonCount] = await Promise.all([
      count("SELECT COUNT(*) AS count FROM users WHERE role = 'student'"),
      count("SELECT COUNT(*) AS count FROM users WHERE role = 'student' AND is_blocked = 1"),
      count('SELECT COUNT(*) AS count FROM levels'),
      count('SELECT COUNT(*) AS count FROM lessons'),
      count("SELECT COUNT(*) AS count FROM homework_submissions WHERE COALESCE(status, 'pending') IN ('pending', 'submitted')"),
      count("SELECT COUNT(*) AS count FROM user_progress WHERE status = 'completed'"),
    ]);
    return { studentCount, blockedStudentCount, courseCount, lessonCount, pendingHomeworkCount, completedLessonCount };
  },

  async getAsset(assetId: string): Promise<LegacyAsset | null> {
    const rows = await rowsOf(database,
      'SELECT id, mime_type, data FROM app_assets WHERE id = ? LIMIT 1',
      [assetId]);
    const row = rows[0];
    if (!row || typeof row.id !== 'string' || typeof row.mime_type !== 'string' || typeof row.data !== 'string') return null;
    return { id: row.id, mimeType: row.mime_type, base64Data: row.data };
  },

  async isAssetReferencedByCourse(assetId: string, courseId: number): Promise<boolean> {
    const rows = await rowsOf(database,
      'SELECT lesson_blocks.content FROM lesson_blocks JOIN lessons ON lessons.id = lesson_blocks.lesson_id WHERE lessons.level_id = ?',
      [courseId]);
    const referenced = (value: unknown): boolean => {
      if (typeof value === 'string') {
        if (value === assetId || value.endsWith(`/api/assets/${assetId}`)) return true;
        try { return referenced(JSON.parse(value)); } catch { return false; }
      }
      if (Array.isArray(value)) return value.some(referenced);
      return Boolean(value && typeof value === 'object' && Object.values(value as Record<string, unknown>).some(referenced));
    };
    return rows.some(row => referenced(row.content));
  },

  async getHomeworkById(submissionId: number): Promise<LegacyHomeworkSubmission | null> {
    const rows = await rowsOf(database,
      `SELECT h.id, CAST(h.user_id AS INTEGER) AS user_id, CAST(h.lesson_id AS INTEGER) AS lesson_id,
              h.text AS answer_text, h.file_url, h.file_name,
              h.submitted_at, h.updated_at, h.grade, h.feedback, h.status
       FROM homework_submissions h
       JOIN users owner ON owner.id = h.user_id
       JOIN lessons lesson ON lesson.id = h.lesson_id
       WHERE h.id = ? LIMIT 1`,
      [submissionId]);
    return rows[0] ? homeworkFromRow(rows[0]) : null;
  },

  async listHomeworkForUser(userId: number): Promise<readonly LegacyHomeworkSubmission[]> {
    const rows = await rowsOf(database,
      `SELECT h.id, CAST(h.user_id AS INTEGER) AS user_id, CAST(h.lesson_id AS INTEGER) AS lesson_id,
              h.text AS answer_text, h.file_url, h.file_name,
              h.submitted_at, h.updated_at, h.grade, h.feedback, h.status
       FROM homework_submissions h
       JOIN users owner ON owner.id = h.user_id
       JOIN lessons lesson ON lesson.id = h.lesson_id
       WHERE h.user_id = ? ORDER BY h.submitted_at DESC, h.id DESC`,
      [userId]);
    return rows.map(homeworkFromRow);
  },

  async listHomeworkForTeacher(status?: 'pending' | 'graded'): Promise<readonly LegacyHomeworkSubmission[]> {
    const filter = status === undefined ? '' : " WHERE CASE WHEN h.status = 'graded' OR h.grade IS NOT NULL THEN 'graded' ELSE 'pending' END = ?";
    const args: InArgs = status === undefined ? [] : [status];
    const rows = await rowsOf(database,
      `SELECT h.id, CAST(h.user_id AS INTEGER) AS user_id, CAST(h.lesson_id AS INTEGER) AS lesson_id,
              h.text AS answer_text, h.file_url, h.file_name,
              h.submitted_at, h.updated_at, h.grade, h.feedback, h.status
       FROM homework_submissions h
       JOIN users owner ON owner.id = h.user_id
       JOIN lessons lesson ON lesson.id = h.lesson_id${filter}
       ORDER BY h.submitted_at DESC, h.id DESC`,
      args);
    return rows.map(homeworkFromRow);
  },

  async getStudentOverview(studentId: number): Promise<LegacyStudentOverview | null> {
    const user = await this.getUserById(studentId);
    if (!user || user.role !== 'student') return null;
    const completedRows = await rowsOf(database,
      "SELECT COUNT(*) AS count FROM user_progress WHERE user_id = ? AND status = 'completed'",
      [studentId]);
    const totalRows = await rowsOf(database, 'SELECT COUNT(*) AS count FROM lessons', []);
    const scoreRows = await rowsOf(database,
      "SELECT AVG(score) AS average_score FROM user_progress WHERE user_id = ? AND status = 'completed' AND score IS NOT NULL",
      [studentId]);
    const pendingRows = await rowsOf(database,
      "SELECT COUNT(*) AS count FROM homework_submissions WHERE user_id = ? AND COALESCE(status, 'pending') IN ('pending', 'submitted')",
      [studentId]);
    const numeric = (value: unknown): number => typeof value === 'number' ? value : Number(value ?? 0);
    const average = scoreRows[0]?.average_score;
    return {
      user,
      completedLessons: Math.max(0, Math.round(numeric(completedRows[0]?.count))),
      totalLessons: Math.max(0, Math.round(numeric(totalRows[0]?.count))),
      averageScore: average === null || average === undefined ? null : Math.max(0, Math.min(10, numeric(average))),
      pendingHomework: Math.max(0, Math.round(numeric(pendingRows[0]?.count))),
    };
  },

  async listCourses(): Promise<readonly LegacyCourse[]> {
    const rows = await rowsOf(database,
      'SELECT levels.id, levels.title, levels.description, levels."order" AS course_order, COUNT(lessons.id) AS lesson_count FROM levels LEFT JOIN lessons ON lessons.level_id = levels.id GROUP BY levels.id ORDER BY levels."order", levels.id',
      []);
    return rows.map(courseFromRow);
  },

  async listLessonSummaries(courseId: number): Promise<readonly LegacyLessonSummary[]> {
    const rows = await rowsOf(database,
      'SELECT lessons.id, lessons.title, lessons."order" AS lesson_order, COUNT(lesson_blocks.id) AS block_count, MAX(CASE WHEN lesson_blocks.type = ? THEN 1 ELSE 0 END) AS has_homework FROM lessons LEFT JOIN lesson_blocks ON lesson_blocks.lesson_id = lessons.id WHERE lessons.level_id = ? GROUP BY lessons.id ORDER BY lessons."order", lessons.id',
      ['homework', courseId]);
    return rows.map((row): LegacyLessonSummary => ({
      id: requiredNumber(row, 'id'),
      title: stringValue(row, 'title'),
      order: requiredNumber(row, 'lesson_order'),
      blockCount: requiredNumber(row, 'block_count'),
      hasHomework: Number(row.has_homework) === 1,
    }));
  },

  async getCoursePath(courseId: number, userId: number): Promise<readonly LegacyCoursePathRecord[]> {
    const lessonRows = await rowsOf(database,
      'SELECT id, title, "order" AS lesson_order FROM lessons WHERE level_id = ? ORDER BY "order", id',
      [courseId]);
    const progressRows = await rowsOf(database,
      'SELECT lesson_id, status, unlocks_at, completed_at, score FROM user_progress WHERE user_id = ? AND lesson_id IN (SELECT id FROM lessons WHERE level_id = ?)',
      [userId, courseId]);
    const homeworkRows = await rowsOf(database,
      'SELECT lesson_id, grade, status FROM homework_submissions WHERE user_id = ? AND lesson_id IN (SELECT id FROM lessons WHERE level_id = ?) ORDER BY submitted_at DESC, id DESC',
      [userId, courseId]);
    const homeworkLessonRows = await rowsOf(database,
      'SELECT DISTINCT lesson_id FROM lesson_blocks WHERE type = ? AND lesson_id IN (SELECT id FROM lessons WHERE level_id = ?)',
      ['homework', courseId]);

    const progressByLesson = new Map<number, LegacyRow>();
    for (const row of progressRows) {
      progressByLesson.set(requiredNumber(row, 'lesson_id'), row);
    }
    const homeworkByLesson = new Map<number, LegacyRow>();
    for (const row of homeworkRows) {
      const lessonId = requiredNumber(row, 'lesson_id');
      if (!homeworkByLesson.has(lessonId)) homeworkByLesson.set(lessonId, row);
    }
    const homeworkLessonIds = new Set(homeworkLessonRows.map((row) => requiredNumber(row, 'lesson_id')));

    return lessonRows.map((row): LegacyCoursePathRecord => {
      const lessonId = requiredNumber(row, 'id');
      const progress = progressByLesson.get(lessonId);
      const homework = homeworkByLesson.get(lessonId);
      return {
        lessonId,
        title: stringValue(row, 'title'),
        order: requiredNumber(row, 'lesson_order'),
        status: progress ? nullableString(progress, 'status') : null,
        unlocksAt: progress ? nullableString(progress, 'unlocks_at') : null,
        completedAt: progress ? nullableString(progress, 'completed_at') : null,
        score: progress ? nullableNumber(progress, 'score') : null,
        homeworkStatus: homework ? nullableString(homework, 'status') : null,
        homeworkGrade: homework ? legacyGradeToTenPoint(homework) : null,
        hasHomework: homeworkLessonIds.has(lessonId),
      };
    });
  },

  async getLesson(lessonId: number): Promise<LegacyLesson | null> {
    const lessonRows = await rowsOf(database,
      'SELECT id, level_id, title, "order" AS lesson_order FROM lessons WHERE id = ? LIMIT 1',
      [lessonId]);
    const lesson = lessonRows[0];
    if (!lesson) return null;

    const blockRows = await rowsOf(database,
      'SELECT id, type, content, "order" AS block_order FROM lesson_blocks WHERE lesson_id = ? ORDER BY "order", id',
      [lessonId]);
    return lessonFromRow(lesson, blockRows.map(blockFromRow));
  },

  async listFlashcardsForUser(user: LegacyUser, limit: number | null = null): Promise<readonly LegacyFlashcard[]> {
    const safeLimit = limit === null ? null : Math.max(1, Math.min(20, Math.trunc(limit)));
    const limitSql = safeLimit === null ? '' : ' LIMIT ?';
    const args: InArgs = [user.id, user.telegramId];
    if (safeLimit !== null) args.push(safeLimit);
    const rows = await rowsOf(database, `
      SELECT f.id, f.lesson_id, f.word, f.translation, f.example_phrase,
             lessons.title AS lesson_title,
             COALESCE(progress.times_shown, 0) AS times_shown,
             COALESCE(progress.times_correct, 0) AS times_correct,
             COALESCE(progress.times_wrong, 0) AS times_wrong,
             COALESCE(progress.ease_factor, 2.5) AS ease_factor,
             COALESCE(progress.interval_days, 0) AS interval_days,
             progress.next_review_at
      FROM flashcards f
      JOIN lessons ON lessons.id = f.lesson_id
      JOIN user_progress unlocked ON unlocked.lesson_id = f.lesson_id
        AND unlocked.user_id = ?
        AND unlocked.status IN ('completed', 'unlocked')
      LEFT JOIN user_flashcard_progress progress
        ON progress.flashcard_id = f.id AND progress.user_id = ?
      ORDER BY
        CASE
          WHEN progress.times_shown IS NULL OR progress.times_shown = 0 THEN 0
          WHEN progress.next_review_at IS NULL OR progress.next_review_at <= datetime('now') THEN 1
          ELSE 2
        END,
        lessons."order", f.id${limitSql}`, args);
    return rows.map((row): LegacyFlashcard => ({
      id: requiredNumber(row, 'id'),
      lessonId: requiredNumber(row, 'lesson_id'),
      lessonTitle: stringValue(row, 'lesson_title'),
      front: stringValue(row, 'word'),
      back: stringValue(row, 'translation'),
      examplePhrase: typeof row.example_phrase === 'string' ? row.example_phrase : null,
      timesShown: Math.max(0, Number(row.times_shown ?? 0)),
      timesCorrect: Math.max(0, Number(row.times_correct ?? 0)),
      timesWrong: Math.max(0, Number(row.times_wrong ?? 0)),
      easeFactor: Math.max(1.3, Number(row.ease_factor ?? 2.5)),
      intervalDays: Math.max(0, Number(row.interval_days ?? 0)),
      nextReviewAt: typeof row.next_review_at === 'string' ? row.next_review_at : null,
    }));
  },
});
