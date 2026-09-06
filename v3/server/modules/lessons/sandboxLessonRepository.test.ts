import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { initializeSandboxAttemptSchema } from '../progress/sandboxAttemptRepository.js';
import { initializeSandboxHomeworkSchema } from '../homework/sandboxHomeworkRepository.js';
import { initializeSandboxLessonDraftSchema, saveSandboxLessonDraft } from '../teacher/sandboxLessonDraftRepository.js';
import {
  createSandboxLesson,
  deleteSandboxLesson,
  getEffectiveLesson,
  initializeSandboxLessonSchema,
  LessonDeleteConflictError,
  listEffectiveLessonSummaries,
  updateSandboxLesson,
} from './sandboxLessonRepository.js';

test('lesson overlay preserves legacy rows and safely manages V3 lessons', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-lesson-overlay-'));
  const path = join(root, 'database.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await database.batch([
      'CREATE TABLE lessons (id INTEGER PRIMARY KEY, level_id INTEGER, title TEXT, "order" INTEGER)',
      'CREATE TABLE user_progress (id INTEGER PRIMARY KEY, lesson_id INTEGER)',
      'CREATE TABLE homework_submissions (id INTEGER PRIMARY KEY, lesson_id INTEGER)',
      'CREATE TABLE flashcards (id INTEGER PRIMARY KEY, lesson_id INTEGER)',
    ]);
    await Promise.all([
      initializeSandboxLessonSchema(database),
      initializeSandboxLessonDraftSchema(database),
      initializeSandboxAttemptSchema(database),
      initializeSandboxHomeworkSchema(database),
    ]);
    await database.execute({ sql: "INSERT INTO lessons VALUES (10, 2, 'Legacy row', 1)", args: [] });
    const legacy = { id: 10, courseId: 2, title: 'Legacy row', order: 1, blocks: [] } as const;
    const effectiveLegacy = await getEffectiveLesson(database, 10, legacy);
    assert.ok(effectiveLegacy);
    await updateSandboxLesson(database, effectiveLegacy, { title: 'Renamed safely', order: 2 });
    assert.equal((await getEffectiveLesson(database, 10, legacy))?.title, 'Renamed safely');
    assert.equal((await database.execute('SELECT title FROM lessons WHERE id = 10')).rows[0].title, 'Legacy row');

    const created = await createSandboxLesson(database, { courseId: 2, title: 'V3 lesson', order: 1 });
    assert.ok(created.id >= 1000000);
    await saveSandboxLessonDraft(database, {
      lessonId: created.id, expectedRevision: 0, updatedBy: 9, updatedAt: '2026-09-06T00:00:00.000Z',
      blocks: [{ id: 1, order: 0, type: 'homework', promptHtml: '<p>Write</p>' }],
    });
    const summaries = await listEffectiveLessonSummaries(database, 2, [{
      id: 10, title: 'Legacy row', order: 1, blockCount: 0, hasHomework: false,
    }]);
    assert.deepEqual(summaries.map((lesson) => [lesson.id, lesson.title, lesson.hasHomework]), [
      [created.id, 'V3 lesson', true], [10, 'Renamed safely', false],
    ]);

    await database.execute({ sql: 'INSERT INTO flashcards VALUES (1, ?)', args: [created.id] });
    await assert.rejects(() => deleteSandboxLesson(database, created), LessonDeleteConflictError);
    assert.ok(await getEffectiveLesson(database, created.id, null));
    await database.execute('DELETE FROM flashcards');
    await deleteSandboxLesson(database, created);
    assert.equal(await getEffectiveLesson(database, created.id, null), null);

    const legacyAfterRename = await getEffectiveLesson(database, 10, legacy);
    assert.ok(legacyAfterRename);
    await deleteSandboxLesson(database, legacyAfterRename);
    assert.equal(await getEffectiveLesson(database, 10, legacy), null);
    assert.equal((await database.execute('SELECT COUNT(*) AS count FROM lessons WHERE id = 10')).rows[0].count, 1);
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
