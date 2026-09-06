import assert from 'node:assert/strict';
import { mkdtemp, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createSandboxWriteDatabase } from '../../infrastructure/db/sandboxWriteSql.js';
import {
  createSandboxCourse,
  deleteSandboxCourse,
  initializeSandboxCourseSchema,
  listSandboxCourses,
  updateSandboxCourse,
} from './sandboxCourseRepository.js';

test('sandbox courses support create, override and archive without changing legacy input', async () => {
  const root = await mkdtemp(join(tmpdir(), 'brew-and-speak-course-repo-'));
  const path = join(root, 'sandbox.sqlite');
  const database = createSandboxWriteDatabase({ url: `file:${path}`, mode: 'sandbox' });
  try {
    await initializeSandboxCourseSchema(database);
    const legacy = [{ id: 2, title: 'Legacy', description: 'Old', order: 1, lessonCount: 4 }];
    const created = await createSandboxCourse(database, { title: 'New', description: 'New desc', order: 2 });
    assert.ok(created.id >= 100000);
    assert.equal((await listSandboxCourses(database, legacy)).length, 2);
    const updated = await updateSandboxCourse(database, { course: legacy[0], title: 'Edited' });
    assert.equal(updated.title, 'Edited');
    assert.equal((await listSandboxCourses(database, legacy)).find((course) => course.id === 2)?.title, 'Edited');
    await deleteSandboxCourse(database, legacy[0]);
    assert.equal((await listSandboxCourses(database, legacy)).some((course) => course.id === 2), false);
    const concurrent = await Promise.all(Array.from({ length: 8 }, (_, index) =>
      createSandboxCourse(database, { title: `Concurrent ${index}`, description: '', order: index })));
    assert.equal(new Set(concurrent.map((course) => course.id)).size, 8);
    assert.ok(concurrent.every((course) => course.id > created.id));
  } finally {
    database.close();
    await unlink(path).catch(() => undefined);
  }
});
