import { readdir } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const roots = process.argv.slice(2);

if (roots.length === 0) {
  console.error('Usage: node scripts/run-tests.mjs <directory> [...]');
  process.exit(2);
}

const collect = async directory => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(path));
    else if (entry.name.endsWith('.test.ts') && extname(entry.name) === '.ts') files.push(path);
  }
  return files;
};

const files = (await Promise.all(roots.map(root => collect(resolve(projectRoot, root)))))
  .flat()
  .sort()
  .map(file => relative(projectRoot, file));

if (files.length === 0) {
  console.error(`No .test.ts files found under: ${roots.join(', ')}`);
  process.exit(2);
}

const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...files], {
  cwd: projectRoot,
  env: process.env,
  stdio: 'inherit',
});

child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
