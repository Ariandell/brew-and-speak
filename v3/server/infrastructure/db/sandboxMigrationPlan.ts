import type { SandboxWriteDatabase } from './sandboxWriteSql.js';
import type { WriteDatabase } from './writeSql.js';
import { runSandboxMigrations, type SandboxMigration } from './sandboxMigrations.js';
import { initializeSandboxCommunicationSchema } from '../../modules/communication/sandboxCommunicationRepository.js';
import { initializeSandboxCourseSchema } from '../../modules/courses/sandboxCourseRepository.js';
import { initializeSandboxEnrollmentSchema } from '../../modules/courses/sandboxEnrollmentRepository.js';
import { initializeSandboxSrsSchema } from '../../modules/flashcards/sandboxSrsRepository.js';
import { initializeSandboxHomeworkSchema } from '../../modules/homework/sandboxHomeworkRepository.js';
import { initializeSandboxAttemptSchema } from '../../modules/progress/sandboxAttemptRepository.js';
import { initializeSandboxStudentControlSchema } from '../../modules/teacher/sandboxStudentControlRepository.js';
import { initializeSandboxLessonDraftSchema } from '../../modules/teacher/sandboxLessonDraftRepository.js';
import { initializeSandboxLessonSchema, lessonSchemaStatements } from '../../modules/lessons/sandboxLessonRepository.js';
import { initializeSandboxAssetSchema } from '../../modules/media/sandboxAssetRepository.js';
import { PRODUCTION_SCHEMA_PLAN } from './schemaVersion.js';
import { vocabularySchemaSql } from '../../modules/teacher/lessonVocabularyRepository.js';

const migrations: readonly SandboxMigration[] = [{
  id: 'v3-001-sandbox-module-schema',
  statements: [
    `CREATE TABLE IF NOT EXISTS v3_backend_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],
}, {
  id: 'v3-002-lesson-overlays',
  statements: lessonSchemaStatements,
}, {
  id: 'v3-003-lesson-vocabulary',
  statements: [vocabularySchemaSql],
}];

/**
 * The only supported way to prepare a local v3 database. It is deliberately
 * not imported by the production server entrypoint.
 */
export const applyV3MigrationPlan = async (database: WriteDatabase): Promise<readonly string[]> => {
  const applied = await runSandboxMigrations(database, migrations);
  await initializeSandboxCommunicationSchema(database);
  await initializeSandboxCourseSchema(database);
  await initializeSandboxEnrollmentSchema(database);
  await initializeSandboxSrsSchema(database);
  await initializeSandboxHomeworkSchema(database);
  await initializeSandboxAttemptSchema(database);
  await initializeSandboxStudentControlSchema(database);
  await initializeSandboxLessonDraftSchema(database);
  await initializeSandboxLessonSchema(database);
  await initializeSandboxAssetSchema(database);
  await database.execute({
    sql: `INSERT INTO v3_backend_meta (key, value) VALUES ('schema_plan', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    args: [PRODUCTION_SCHEMA_PLAN],
  });
  return applied;
};

export const applySandboxMigrationPlan = (database: SandboxWriteDatabase): Promise<readonly string[]> =>
  applyV3MigrationPlan(database);
