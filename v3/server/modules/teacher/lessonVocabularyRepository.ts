import type { ReadOnlyDatabase } from '../../infrastructure/db/readOnlySql.js';
import type { SandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import { vocabularySchema, type LessonVocabulary } from '../../../src/api/vocabularyContracts.js';

export const vocabularySchemaSql = `CREATE TABLE IF NOT EXISTS v3_lesson_vocabulary (
    lesson_id INTEGER PRIMARY KEY, revision INTEGER NOT NULL, items_json TEXT NOT NULL
)`;

// Old card IDs stay intact, so editing spelling never resets student progress.
export async function loadLessonVocabulary(read: ReadOnlyDatabase, write: SandboxWriteDatabase, lessonId: number): Promise<LessonVocabulary> {
    const overlay = await write.execute({ sql: 'SELECT revision, items_json FROM v3_lesson_vocabulary WHERE lesson_id = ?', args: [lessonId] });
    if (overlay.rows[0]) return vocabularySchema.parse({ revision: Number(overlay.rows[0].revision), items: JSON.parse(String(overlay.rows[0].items_json)) });
    const legacy = await read.execute({ sql: 'SELECT id, word, translation FROM flashcards WHERE lesson_id = ? ORDER BY id', args: [lessonId] });
    return vocabularySchema.parse({ revision: 0, items: legacy.rows.map(row => ({ id: Number(row.id), front: String(row.word), back: String(row.translation) })) });
}

export async function saveLessonVocabulary(write: SandboxWriteDatabase, lessonId: number, input: LessonVocabulary): Promise<boolean> {
    if (input.revision > 0) {
        const update = await write.execute({ sql: 'UPDATE v3_lesson_vocabulary SET revision = revision + 1, items_json = ? WHERE lesson_id = ? AND revision = ?', args: [JSON.stringify(input.items), lessonId, input.revision] });
        return update.rowsAffected === 1;
    }
    const result = await write.execute({
        sql: `INSERT INTO v3_lesson_vocabulary (lesson_id, revision, items_json)
            VALUES (?, 1, ?) ON CONFLICT(lesson_id) DO NOTHING`,
        args: [lessonId, JSON.stringify(input.items)],
    });
    return result.rowsAffected === 1;
}
