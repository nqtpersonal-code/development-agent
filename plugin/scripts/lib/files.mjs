import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const DEFAULT_IGNORE = [
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.superpowers', '.turbo', '.cache',
  'out', 'vendor', '__pycache__', '.venv', 'graphify-out', 'bin', 'obj', '.vs',
];
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|7z|woff2?|ttf|eot|mp4|mp3|exe|dll|so|dylib|lock|bin)$/i;
const SKIP_FILE = /(^|[\\/])(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$|\.min\.(js|css)$/i;

// Walks text files under root, yielding absolute paths. Skips ignored dirs,
// binaries, lockfiles and minified bundles.
export function* walkFiles(root, ignore = DEFAULT_IGNORE) {
  const ig = new Set(ignore);
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (!ig.has(e.name)) stack.push(p);
      } else if (e.isFile() && !BINARY_EXT.test(e.name) && !SKIP_FILE.test(p)) {
        yield p;
      }
    }
  }
}

export function readText(path, maxBytes = 2_000_000) {
  try {
    if (statSync(path).size > maxBytes) return null;
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

export const rel = (root, p) => relative(root, p).split(sep).join('/');
