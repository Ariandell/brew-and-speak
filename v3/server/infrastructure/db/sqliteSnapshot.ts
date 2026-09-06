import { createHash } from 'node:crypto';
import { copyFile, mkdir, stat, unlink, rename } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export type SqliteSnapshot = {
  sourcePath: string;
  snapshotPath: string;
  sourceSha256: string;
  snapshotSha256: string;
  bytes: number;
};

export const sha256File = async (path: string): Promise<string> => new Promise((resolveHash, reject) => {
  const hash = createHash('sha256');
  const stream = createReadStream(path);
  stream.on('data', (chunk) => hash.update(chunk));
  stream.on('error', reject);
  stream.on('end', () => resolveHash(hash.digest('hex')));
});

const safeLabel = (label: string): string => {
  const normalized = label.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'legacy';
};

export const createSqliteSnapshot = async (options: {
  sourcePath: string;
  destinationDirectory: string;
  label?: string;
}): Promise<SqliteSnapshot> => {
  const sourcePath = resolve(options.sourcePath);
  const destinationDirectory = resolve(options.destinationDirectory);
  const sourceInfo = await stat(sourcePath);

  if (!sourceInfo.isFile()) throw new Error(`SQLite source is not a file: ${sourcePath}`);
  if (sourcePath === destinationDirectory || destinationDirectory.startsWith(`${sourcePath}\\`)) {
    throw new Error('Snapshot destination cannot be the SQLite source or a child of it');
  }

  await mkdir(destinationDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const sourceName = basename(sourcePath, '.sqlite');
  const targetPath = join(destinationDirectory, `${safeLabel(options.label ?? sourceName)}-${timestamp}.sqlite`);
  const partialPath = `${targetPath}.partial`;

  const sourceSha256 = await sha256File(sourcePath);
  try {
    await copyFile(sourcePath, partialPath);
    const snapshotSha256 = await sha256File(partialPath);
    if (snapshotSha256 !== sourceSha256) {
      throw new Error('Snapshot hash mismatch; source was not copied safely');
    }
    await rename(partialPath, targetPath);
    return {
      sourcePath,
      snapshotPath: targetPath,
      sourceSha256,
      snapshotSha256,
      bytes: sourceInfo.size,
    };
  } catch (error) {
    await unlink(partialPath).catch(() => undefined);
    throw error;
  }
};
