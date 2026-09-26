// Builds the deployable site into dist/:
//   1. copies the existing static site (the repo root) — minus source, config
//      and server code that should never be publicly downloadable;
//   2. builds the Watchtower app (Vite) into dist/watchtower/.
// Vercel serves dist/ (vercel.json → outputDirectory). Functions in /api are
// deployed separately by Vercel and are unaffected.
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'dist');

const DENY_DIRS = new Set([
  '.git', '.github', '.vercel', '.claude', 'node_modules', 'dist', 'api', 'lib', 'shared', 'watchtower-app',
  'data', 'tests', 'docs', 'scripts', 'netlify', 'functions', 'archive',
]);
const DENY_FILES = new Set([
  'package.json', 'package-lock.json', 'tsconfig.json', 'vercel.json', 'netlify.toml', 'firebase.json',
  '.firebaserc', 'firestore.rules', 'storage.rules', '_headers', '.gitignore', '.DS_Store', '.vercelignore',
  'vitest.config.mts',
]);
const denyFile = (name) => DENY_FILES.has(name) || name.endsWith('.md') || name.startsWith('.env');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

let copied = 0;
for (const name of readdirSync(root)) {
  const src = join(root, name);
  const isDir = statSync(src).isDirectory();
  if (isDir ? DENY_DIRS.has(name) || name.startsWith('.') : denyFile(name)) continue;
  cpSync(src, join(out, name), {
    recursive: true,
    filter: (p) => !p.endsWith('.DS_Store'),
  });
  copied++;
}
console.log(`[build-site] copied ${copied} static entries to dist/`);

execSync('npx vite build --config watchtower-app/vite.config.mts', { cwd: root, stdio: 'inherit' });

if (!existsSync(join(out, 'watchtower', 'index.html'))) {
  console.error('[build-site] Watchtower build missing');
  process.exit(1);
}
console.log('[build-site] done');
