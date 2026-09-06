import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ignored = new Set(['node_modules', 'dist', '.sandbox', '.git']);
const secretPatterns = [
  /AQ\.[A-Za-z0-9_-]{20,}/,
  /AIza[A-Za-z0-9_-]{20,}/,
  /X-goog-api-key/i,
  /TELEGRAM_BOT_TOKEN\s*[:=]\s*['"]/,
];
const matches: string[] = [];

const walk = async (directory: string): Promise<void> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(path);
      continue;
    }
    if (entry.name === 'secretScan.ts') continue;
    if (!/\.(ts|tsx|js|mjs|json|md|html|css|env|yml|yaml)$/.test(entry.name)) continue;
    const content = await readFile(path, 'utf8');
    if (secretPatterns.some((pattern) => pattern.test(content))) matches.push(path);
  }
};

await walk(process.cwd());
if (matches.length > 0) {
  console.error(`Potential secret material found in ${matches.length} file(s):`);
  for (const path of matches) console.error(path);
  process.exitCode = 1;
} else {
  console.log('Secret scan passed');
}
