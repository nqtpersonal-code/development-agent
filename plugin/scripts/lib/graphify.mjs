import { existsSync, mkdirSync, readFileSync, appendFileSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Optional bridge to Graphify (third-party, installed separately by the owner).
// The plugin never depends on it: every caller falls back to name search.

export function graphifyAvailable() {
  return spawnSync('graphify --version', { shell: true, encoding: 'utf8' }).status === 0;
}

// Builds a code-only graph and keeps the output outside the project repo.
// Graphify writes graphify-out/ in the project; it is moved to outDir and the
// folder name is added to .git/info/exclude (never .gitignore).
export function buildGraph(projectRoot, outDir) {
  if (!graphifyAvailable()) return { ok: false, outDir, note: 'graphify not installed' };
  const r = spawnSync('graphify .', { shell: true, cwd: projectRoot, encoding: 'utf8', stdio: 'pipe' });
  const produced = join(projectRoot, 'graphify-out');
  if (r.status !== 0 || !existsSync(produced)) return { ok: false, outDir, note: `graphify failed: ${(r.stderr || '').slice(0, 200)}` };
  mkdirSync(outDir, { recursive: true });
  for (const f of readdirSync(produced)) cpSync(join(produced, f), join(outDir, f), { recursive: true });
  rmSync(produced, { recursive: true, force: true });
  const exclude = join(projectRoot, '.git', 'info', 'exclude');
  if (existsSync(join(projectRoot, '.git'))) {
    const cur = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
    if (!cur.split(/\r?\n/).includes('graphify-out/')) appendFileSync(exclude, `${cur.endsWith('\n') || !cur ? '' : '\n'}graphify-out/\n`);
  }
  return { ok: true, outDir, note: 'graph built' };
}

// Reads a node-link graph.json and returns symbols that call `symbol`.
// Format assumed (networkx node-link style); verify against a real Graphify run.
export function callersFromGraph(outDir, symbol) {
  const f = join(outDir, 'graph.json');
  if (!existsSync(f)) return [];
  const g = JSON.parse(readFileSync(f, 'utf8'));
  const nodes = new Map((g.nodes ?? []).map((n) => [n.id, n]));
  const label = (n) => n?.label ?? n?.name ?? n?.id;
  const fileOf = (n) => n?.source_file ?? n?.file ?? n?.path ?? '';
  const target = [...nodes.values()].find((n) => label(n) === symbol);
  if (!target) return [];
  return (g.links ?? g.edges ?? [])
    .filter((e) => (e.target === target.id) && /call/i.test(e.relation ?? e.type ?? 'calls'))
    .map((e) => nodes.get(e.source))
    .filter(Boolean)
    .map((n) => ({ file: fileOf(n), symbol: label(n) }));
}

