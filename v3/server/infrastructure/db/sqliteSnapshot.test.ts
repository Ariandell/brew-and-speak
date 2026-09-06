import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSqliteSnapshot } from './sqliteSnapshot.js';

test('sqlite snapshot copies the source and verifies its hash', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-snapshot-'));
  const sourcePath = join(root, 'legacy.sqlite');
  const destinationDirectory = join(root, 'snapshots');
  const source = Buffer.from('SQLite format 3\u0000test snapshot');
  await writeFile(sourcePath, source);

  const snapshot = await createSqliteSnapshot({
    sourcePath,
    destinationDirectory,
    label: 'legacy rehearsal',
  });

  assert.equal(snapshot.bytes, source.length);
  assert.equal(snapshot.sourceSha256, snapshot.snapshotSha256);
  assert.deepEqual(await readFile(snapshot.snapshotPath), source);
  assert.match(snapshot.snapshotPath, /legacy-rehearsal-.*\.sqlite$/);
});
