import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { listRepos } from './workspace.mjs';
import { extractRefs } from './links.mjs';

// The analysis describes the code as it was when it was traced. A ticket can sit
// for days between steps; if the code under the cited places changes before
// implementation, the map may be wrong. The stamp records each repo's commit at
// analysis time so `start` can say which cited files have changed since.
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const stampFile = (work) => join(work, 'trace', 'stamp.json');

export function stampCode(work, root) {
  const repos = listRepos(root);
  const heads = {};
  for (const r of repos.length ? repos : [{ dir: '.' }]) {
    const head = git(join(root, r.dir), ['rev-parse', 'HEAD']);
    if (head.status === 0) heads[r.dir] = head.stdout.trim();
  }
  mkdirSync(join(work, 'trace'), { recursive: true });
  writeFileSync(stampFile(work), JSON.stringify({ takenAt: new Date().toISOString(), repos: heads }, null, 2), 'utf8');
  return heads;
}

// Files cited in the impact map that changed since the stamp, per repo.
// { stamped: false } when there is no stamp; `moved` counts every changed file.
export function changesSinceStamp(work, root) {
  if (!existsSync(stampFile(work))) return { stamped: false, repos: [] };
  const stamp = JSON.parse(readFileSync(stampFile(work), 'utf8'));
  const impact = existsSync(join(work, 'trace', 'impact.md')) ? readFileSync(join(work, 'trace', 'impact.md'), 'utf8') : '';
  const cited = [...new Set(extractRefs(impact).map((r) => r.path.replaceAll('\\', '/').toLowerCase()))];
  const isCited = (file) => {
    const f = file.toLowerCase();
    return cited.some((c) => (c.includes('/') ? f.endsWith(c) || c.endsWith(f) : basename(f) === c));
  };
  const out = [];
  for (const [dir, sha] of Object.entries(stamp.repos ?? {})) {
    const cwd = join(root, dir);
    const head = git(cwd, ['rev-parse', 'HEAD']);
    if (head.status !== 0) continue;
    if (head.stdout.trim() === sha) continue;
    const diff = git(cwd, ['diff', '--name-only', `${sha}..HEAD`]);
    if (diff.status !== 0) {
      out.push({ dir, unknown: true, moved: 0, cited: [] });
      continue;
    }
    const files = diff.stdout.split('\n').filter(Boolean);
    out.push({ dir, unknown: false, moved: files.length, cited: files.filter(isCited) });
  }
  return { stamped: true, takenAt: stamp.takenAt, repos: out };
}
