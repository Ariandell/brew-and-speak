import { createHash } from 'node:crypto';
import type { InStatement } from '@libsql/client';
import type { SandboxWriteDatabase } from './sandboxWriteSql.js';

export type SandboxMigration = {
  id: string;
  statements: readonly InStatement[];
};

export class MigrationChecksumConflictError extends Error {
  constructor(id: string) {
    super(`Migration checksum conflict: ${id}`);
    this.name = 'MigrationChecksumConflictError';
  }
}

const checksumOf = (migration: SandboxMigration): string => createHash('sha256')
  .update(JSON.stringify({ id: migration.id, statements: migration.statements }))
  .digest('hex');

const schemaStatement: InStatement = `CREATE TABLE IF NOT EXISTS v3_schema_migrations (
  id TEXT PRIMARY KEY,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL
)`;

export const runSandboxMigrations = async (
  database: SandboxWriteDatabase,
  migrations: readonly SandboxMigration[],
  now = new Date(),
): Promise<readonly string[]> => {
  await database.batch([schemaStatement]);
  const applied: string[] = [];
  for (const migration of migrations) {
    const checksum = checksumOf(migration);
    const result = await database.execute({
      sql: 'SELECT checksum FROM v3_schema_migrations WHERE id = ?',
      args: [migration.id],
    });
    const existing = result.rows[0] as unknown as Record<string, unknown> | undefined;
    if (existing) {
      if (String(existing.checksum) !== checksum) throw new MigrationChecksumConflictError(migration.id);
      continue;
    }
    await database.batch([
      ...migration.statements,
      {
        sql: 'INSERT INTO v3_schema_migrations (id, checksum, applied_at) VALUES (?, ?, ?)',
        args: [migration.id, checksum, now.toISOString()],
      },
    ]);
    applied.push(migration.id);
  }
  return applied;
};
