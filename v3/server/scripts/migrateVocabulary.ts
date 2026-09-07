import { createWriteDatabase } from '../infrastructure/db/writeSql.js';
import { runSandboxMigrations } from '../infrastructure/db/sandboxMigrations.js';
import { vocabularySchemaSql } from '../modules/teacher/lessonVocabularyRepository.js';

// Additive hotfix: never alters an existing table, lesson, card or progress row.
const url = process.env.TURSO_DATABASE_URL;
if (!url || new URL(url).hostname !== 'brew-db-ariandell.aws-eu-west-1.turso.io'
    || process.env.V3_VOCABULARY_MIGRATION !== 'ADD_VOCABULARY_TABLE') {
    throw new Error('Explicit vocabulary migration target confirmation is required');
}
const database = createWriteDatabase({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
    const applied = await runSandboxMigrations(database, [{ id: 'v3-003-lesson-vocabulary', statements: [vocabularySchemaSql] }]);
    const check = await database.execute('SELECT COUNT(*) AS count FROM v3_lesson_vocabulary');
    console.log(JSON.stringify({ applied, vocabularyLessons: Number(check.rows[0].count), legacyDataModified: false }));
} finally { database.close(); }
