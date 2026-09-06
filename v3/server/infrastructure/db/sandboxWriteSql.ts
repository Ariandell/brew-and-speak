import type { InStatement, ResultSet } from '@libsql/client';
import { assertSandboxDatabaseUrl } from './sandboxGuard.js';
import { createWriteDatabase } from './writeSql.js';

export type SandboxWriteDatabase = {
  execute(statement: InStatement): Promise<ResultSet>;
  batch(statements: readonly InStatement[]): Promise<readonly ResultSet[]>;
  close(): void;
};

/**
 * Explicitly sandbox-only writer. It is intentionally not used by createApp.
 * The mode literal and file: guard make an accidental production connection a
 * configuration error before the first statement is sent.
 */
export const createSandboxWriteDatabase = (options: {
  url: string;
  mode: 'sandbox';
}): SandboxWriteDatabase => {
  return createWriteDatabase({ url: assertSandboxDatabaseUrl(options.url) });
};
