import { spawnSync } from 'node:child_process';
import { walkFiles, readText, rel } from './files.mjs';

// Commit messages may be Vietnamese ("sửa lỗi" = bug fix).
const FIX = /^(fix|hotfix|bugfix)(\(|:|!|\s)|\b(fix(es|ed)?|bug|hotfix|sửa lỗi)\b/i;

// How often a file changed and how many of those changes were bug fixes.
export function gitHistory(projectRoot, file, { days = 180 } = {}) {
  const r = spawnSync('git', ['log', `--since=${days}.days`, '--format=%ad%x09%s', '--date=short', '--', file], { cwd: projectRoot, encoding: 'utf8' });
  if (r.status !== 0) return { commits: null, fixCommits: null, lastChanged: null, days };
  const rows = r.stdout.split('\n').filter(Boolean).map((l) => l.split('\t'));
  return {
    commits: rows.length,
    fixCommits: rows.filter(([, msg]) => FIX.test(msg ?? '')).length,
    lastChanged: rows[0]?.[0] ?? null,
    days,
  };
}

const TEST_FILE = /(\.|_)(test|spec)\.[cm]?[jt]sx?$|(^|\/)(__tests__|tests?|e2e)\//i;

// Test files that mention any of the given symbols or routes (route params are
// matched loosely: /api/fees/:studentId/invoice matches /api/fees/1/invoice).
export function testCoverage(roots, terms) {
  const res = terms.map((t) => (t.startsWith('/')
    ? new RegExp(t.split('/').map((seg) => (seg.startsWith(':') ? '[^/\'"`]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/'))
    : new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)));
  const files = [];
  for (const root of roots) {
    for (const abs of walkFiles(root)) {
      const r = rel(root, abs);
      if (!TEST_FILE.test(r)) continue;
      const text = readText(abs) ?? '';
      if (res.some((re) => re.test(text))) files.push(r);
    }
  }
  return { files };
}

// Thresholds for how much analysis a code smell on the ticket's path deserves.
export const FULL_ANALYSIS = { copies: 3, reach: 4, fixCommits: 2 };

// quick = the orchestrator asks one question with options; full = dispatch the risk-analyst.
export function riskLevel({ copies = 0, routes = 0, screens = 0, fixCommits = null, dataChange = false }) {
  const reasons = [];
  if (copies >= FULL_ANALYSIS.copies) reasons.push(`${copies} copies of the same rule`);
  if (routes + screens >= FULL_ANALYSIS.reach) reasons.push(`used by ${routes} APIs and ${screens} screens`);
  if (fixCommits !== null && fixCommits >= FULL_ANALYSIS.fixCommits) reasons.push(`${fixCommits} bug-fix commits recently`);
  if (dataChange) reasons.push('existing data would change');
  return { level: reasons.length ? 'full' : 'quick', reasons };
}
