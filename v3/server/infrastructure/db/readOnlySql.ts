import { createClient, type InStatement, type ResultSet } from '@libsql/client';

const READ_ONLY_START = /^(SELECT|WITH)\b/i;
const WRITE_KEYWORD = /\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|REPLACE|TRUNCATE|VACUUM|REINDEX|ATTACH|DETACH|PRAGMA)\b/i;

export const assertReadOnlySql = (sql: string): void => {
  const normalized = sql.trim();
  if (!READ_ONLY_START.test(normalized) || WRITE_KEYWORD.test(normalized) || normalized.includes(';')) {
    throw new Error('Read-only database rejected a non-read SQL statement');
  }
};

export type ReadOnlyDatabase = {
  execute(statement: InStatement): Promise<ResultSet>;
};

export type ReadOnlyDatabaseConfig = {
  url: string;
  authToken?: string;
};

export const createReadOnlyDatabase = ({
  url,
  authToken,
}: ReadOnlyDatabaseConfig): ReadOnlyDatabase => {
  const client = createClient({ url, authToken });

  return {
    execute: async (statement) => {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      assertReadOnlySql(sql);
      return client.execute(statement);
    },
  };
};

export const createReadOnlyDatabaseFromEnv = (): ReadOnlyDatabase | null => {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return null;

  return createReadOnlyDatabase({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
};
