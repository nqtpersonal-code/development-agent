import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

// Runs the linter a project ALREADY uses on the files a change touched, and keeps
// only the findings that sit on lines the change added. Old warnings are not the
// ticket's business, and nothing is installed or configured for the project.

// file -> Set of line numbers added by a unified diff (-U0 is enough).
export function addedLines(diff) {
  const added = new Map();
  let file = null;
  let line = 0;
  for (const raw of String(diff).split(/\r?\n/)) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '');
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!file || file === '/dev/null') continue;
    if (raw.startsWith('+')) {
      if (!added.has(file)) added.set(file, new Set());
      added.get(file).add(line++);
    } else if (!raw.startsWith('-')) line++;
  }
  return added;
}

const norm = (p) => String(p).replaceAll('\\', '/');

// ESLint `--format json` output -> [{ file, line, rule, severity, message }], paths relative to repoDir.
export function parseEslintJson(stdout, repoDir) {
  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    return [];
  }
  const out = [];
  for (const f of data) {
    const file = norm(relative(repoDir, f.filePath));
    for (const m of f.messages ?? []) {
      if (!m.ruleId && /ignored because|matching ignore pattern/i.test(m.message ?? '')) continue; // "File ignored ..."
      out.push({ file, line: m.line ?? 0, rule: m.ruleId ?? 'parse', severity: m.severity === 2 ? 'error' : 'warning', message: String(m.message ?? '').slice(0, 110) });
    }
  }
  return out;
}

// MSBuild warning/error lines -> same shape. `C:\p\File.cs(12,5): warning CS8600: text [proj]`
export function parseDotnetWarnings(output, repoDir) {
  const out = [];
  const seen = new Set();
  for (const raw of String(output).split(/\r?\n/)) {
    const m = /^(.+?)\((\d+)(?:,\d+)?(?:,\d+,\d+)?\):\s+(warning|error)\s+([A-Za-z]+\d+):\s+(.*?)(?:\s+\[[^\]]+\])?$/.exec(raw.trim());
    if (!m) continue;
    const file = norm(relative(repoDir, resolve(repoDir, m[1])));
    const key = `${file}:${m[2]}:${m[4]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ file, line: Number(m[2]), rule: m[4], severity: m[3], message: m[5].slice(0, 110) });
  }
  return out;
}

export const onAddedLines = (findings, added) => findings.filter((f) => added.get(f.file)?.has(f.line));

const ESLINT_CONFIG = /^(eslint\.config\.(c|m)?(js|ts)|\.eslintrc(\.(c)?js|\.json|\.ya?ml)?)$/;
const hasEslintConfig = (dir) => {
  if (readdirSync(dir).some((n) => ESLINT_CONFIG.test(n))) return true;
  try {
    return Boolean(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).eslintConfig);
  } catch {
    return false;
  }
};

// The ESLint the project itself installed (looked up from the repo folder upwards).
export function findEslint(dir, stop) {
  for (let d = resolve(dir); ; d = dirname(d)) {
    const bin = join(d, 'node_modules', 'eslint', 'bin', 'eslint.js');
    if (existsSync(bin)) return bin;
    if (d === resolve(stop) || dirname(d) === d) return null;
  }
}

const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26 });

// One repo: { dir, tools: [{ name, ran, note?, findings }] } with findings on added lines only.
export function lintRepo({ repoDir, root, base, dotnet = false }) {
  const diff = git(repoDir, ['diff', '-U0', `${base}...HEAD`]);
  if (diff.status !== 0) throw new Error(`git diff failed in ${repoDir}: ${(diff.stderr || '').trim().slice(0, 200)}`);
  const added = addedLines(diff.stdout);
  const changed = git(repoDir, ['diff', '--name-only', '--diff-filter=AM', `${base}...HEAD`]).stdout.split('\n').filter(Boolean);
  const tools = [];

  const js = changed.filter((f) => /\.(m|c)?[jt]sx?$/.test(f));
  if (js.length) {
    if (!hasEslintConfig(repoDir)) tools.push({ name: 'eslint', ran: false, note: 'no ESLint configuration in this project', findings: [] });
    else {
      const bin = findEslint(repoDir, root);
      if (!bin) tools.push({ name: 'eslint', ran: false, note: 'ESLint is configured but not installed (run the project\'s own install first)', findings: [] });
      else {
        let findings = [];
        for (let i = 0; i < js.length; i += 40) {
          const r = spawnSync(process.execPath, [bin, '--format', 'json', ...js.slice(i, i + 40)], { cwd: repoDir, encoding: 'utf8', maxBuffer: 1 << 26 });
          findings = findings.concat(parseEslintJson(r.stdout, repoDir));
        }
        tools.push({ name: 'eslint', ran: true, findings: onAddedLines(findings, added) });
      }
    }
  }

  const cs = changed.filter((f) => /\.cs$/.test(f));
  if (cs.length) {
    const target = readdirSync(repoDir).find((n) => /\.sln$/.test(n)) ?? null;
    if (!dotnet) tools.push({ name: 'dotnet', ran: false, note: 'C# files changed; analyzer warnings need a build, which writes bin/obj and can lock a running app: run with --dotnet when that is fine', findings: [] });
    else if (!target && !readdirSync(repoDir).some((n) => /\.csproj$/.test(n))) tools.push({ name: 'dotnet', ran: false, note: 'no .sln or .csproj at the top of this repo', findings: [] });
    else {
      const r = spawnSync(`dotnet build ${target ? `"${target}"` : ''} -nologo -v:minimal -clp:NoSummary`, { shell: true, cwd: repoDir, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 10 * 60 * 1000 });
      tools.push({ name: 'dotnet', ran: true, findings: onAddedLines(parseDotnetWarnings(`${r.stdout}\n${r.stderr}`, repoDir), added) });
    }
  }
  return { dir: relative(root, repoDir).split(sep).join('/') || '.', tools };
}
