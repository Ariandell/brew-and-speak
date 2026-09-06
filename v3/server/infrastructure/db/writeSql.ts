import { createClient, type InStatement, type ResultSet } from '@libsql/client';

export type WriteDatabase = {
  execute(statement: InStatement): Promise<ResultSet>;
  batch(statements: readonly InStatement[]): Promise<readonly ResultSet[]>;
  close(): void;
};

export const createWriteDatabase = (options: { url: string; authToken?: string }): WriteDatabase => {
  const client = createClient({ url: options.url, authToken: options.authToken });
  return {
    execute: statement => client.execute(statement),
    batch: statements => client.batch([...statements], 'write'),
    close: () => client.close(),
  };
};

export const createWriteDatabaseFromEnv = (): WriteDatabase | null => {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;
  return createWriteDatabase({ url, authToken: process.env.TURSO_AUTH_TOKEN });
};
