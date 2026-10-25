// Deterministic plan check: every acceptance criterion has a task, every
// must-patch file is in the plan, no do-not-touch file is. Regression checks
// belong to QA's scenarios, not to the plan, so they are not required here.
const FILE_RE = /(?:\]\(|`)([\w./-]+\.[A-Za-z]{1,5})(?:#[^)`]*)?[)`]/g;
const MUST = /must patch|phải vá/i;
const FORBID = /do not touch|không được đụng/i;

function criteriaIds(brief) {
  const section = /##[^\n]*(acceptance criteria|tiêu chí)[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/i.exec(brief)?.[2] ?? brief;
  return [...new Set([...section.matchAll(/\bTC\d+\b/g)].map((m) => m[0]))];
}

function changePointFiles(brief, re) {
  const out = [];
  for (const line of brief.split(/\r?\n/)) {
    if (!line.trim().startsWith('|') || !re.test(line)) continue;
    for (const m of line.matchAll(FILE_RE)) out.push(m[1]);
  }
  return [...new Set(out)];
}

export function planCheck({ brief, plan, outOfScopeCriteria = [] }) {
  const inPlan = (s) => plan.includes(s) || plan.includes(s.split('/').pop());
  const uncoveredCriteria = criteriaIds(brief).filter((id) => !outOfScopeCriteria.includes(id) && !new RegExp(`\\b${id}\\b`).test(plan));
  const missingMustPatch = changePointFiles(brief, MUST).filter((f) => !inPlan(f));
  const touchesForbidden = changePointFiles(brief, FORBID).filter((f) => plan.includes(f));
  const verdict = uncoveredCriteria.length || missingMustPatch.length || touchesForbidden.length ? 'revise' : 'pass';
  return { verdict, uncoveredCriteria, missingMustPatch, touchesForbidden };
}
