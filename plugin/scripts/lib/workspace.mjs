import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseRemote } from './githost.mjs';

export function remoteOf(dir) {
  if (!existsSync(join(dir, '.git'))) return null;
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) return null;
  const p = parseRemote(r.stdout.trim());
  return p ? { key: `${p.hostname}/${p.repo.toLowerCase()}`, hostname: p.hostname, repo: p.repo } : null;
}

// Git repos in a ticket folder: the folder itself and/or its direct sub-folders
// (a ticket folder can hold one clone per repo, e.g. be/ and fe/).
export function listRepos(root) {
  const out = [];
  if (existsSync(join(root, '.git'))) out.push({ dir: '.', ...(remoteOf(root) ?? {}) });
  for (const name of readdirSync(root).sort()) {
    const dir = join(root, name);
    if (name.startsWith('.') || !statSync(dir).isDirectory() || !existsSync(join(dir, '.git'))) continue;
    out.push({ dir: name, ...(remoteOf(dir) ?? {}) });
  }
  return out;
}

// Components can name their repo by remote ({ remote: 'group/repo', path?: 'src' })
// instead of a fixed folder, so they are found whatever each ticket folder calls its clones.
export function resolveComponents(root, components) {
  const repos = listRepos(root);
  return components.map((c) => {
    if (!c.remote) return c;
    const want = c.remote.toLowerCase();
    const hit = repos.find((r) => r.key && (r.key === want || r.key.endsWith(`/${want}`)));
    if (!hit) return { ...c, root: null };
    const base = hit.dir === '.' ? '' : hit.dir;
    return { ...c, root: [base, c.path].filter(Boolean).join('/') || '.' };
  });
}
