import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { collectLegacyInventory } from '../infrastructure/db/legacyInventory.js';
import { assertLocalSandboxPath, assertSandboxDatabaseUrl } from '../infrastructure/db/sandboxGuard.js';
import { createSandboxWriteDatabase } from '../infrastructure/db/sandboxWriteSql.js';
import { createSqliteSnapshot, sha256File } from '../infrastructure/db/sqliteSnapshot.js';
import {
  finishSandboxAttempt,
  initializeSandboxAttemptSchema,
  recordSandboxAttemptAnswer,
  startSandboxAttempt,
} from '../modules/progress/sandboxAttemptRepository.js';

const sourcePath = assertLocalSandboxPath(process.env.LEGACY_SQLITE_PATH ?? resolve(process.cwd(), '../server/database.sqlite'));
const destinationDirectory = assertLocalSandboxPath(
  process.env.LEGACY_REHEARSAL_DIR ?? resolve(process.cwd(), '.sandbox/rehearsals'),
);

if (!existsSync(sourcePath)) {
  throw new Error(`Legacy SQLite file does not exist: ${sourcePath}`);
}

const snapshot = await createSqliteSnapshot({
  sourcePath,
  destinationDirectory,
  label: 'attempt-rehearsal',
});
const database = createSandboxWriteDatabase({
  url: assertSandboxDatabaseUrl(`file:${snapshot.snapshotPath}`),
  mode: 'sandbox',
});

try {
  await initializeSandboxAttemptSchema(database);
  await startSandboxAttempt(database, {
    attemptId: 'rehearsal-attempt',
    userId: 1,
    lessonId: 1,
    contentRevision: 'legacy-rehearsal-v1',
    scoredBlockIds: ['block-a', 'block-b', 'block-c', 'block-d'],
    startedAt: new Date().toISOString(),
  });
  await recordSandboxAttemptAnswer(database, {
    attemptId: 'rehearsal-attempt',
    blockId: 'block-a',
    outcome: 'correct',
    answeredAt: new Date().toISOString(),
  });
  await recordSandboxAttemptAnswer(database, {
    attemptId: 'rehearsal-attempt',
    blockId: 'block-b',
    outcome: 'wrong',
    answeredAt: new Date().toISOString(),
  });
  const finished = await finishSandboxAttempt(database, {
    attemptId: 'rehearsal-attempt',
    finishedAt: new Date().toISOString(),
  });
  const sourceSha256After = await sha256File(sourcePath);
  if (sourceSha256After !== snapshot.sourceSha256) {
    throw new Error('Legacy source hash changed during sandbox rehearsal');
  }

  console.log(JSON.stringify({
    sourcePath,
    sourceSha256: snapshot.sourceSha256,
    sourceSha256After,
    rehearsalPath: snapshot.snapshotPath,
    rehearsalInitialSha256: snapshot.snapshotSha256,
    finishedAttempt: finished,
    legacyInventory: await collectLegacyInventory({
      execute: (statement) => database.execute(statement),
    }),
  }, null, 2));
} finally {
  database.close();
}
