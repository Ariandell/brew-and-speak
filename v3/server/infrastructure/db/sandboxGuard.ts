import { resolve } from 'node:path';

export const assertLocalSandboxPath = (path: string): string => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Sandbox database tooling is disabled when NODE_ENV=production');
  }

  if (/^(?:libsql|https?):\/\//i.test(path.trim())) {
    throw new Error('Sandbox database tooling accepts local SQLite paths only');
  }

  return resolve(path);
};

export const assertSandboxDatabaseUrl = (url: string): string => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Sandbox database tooling is disabled when NODE_ENV=production');
  }

  if (!/^file:/i.test(url.trim())) {
    throw new Error('Sandbox database tooling accepts file: SQLite URLs only');
  }

  return url;
};
