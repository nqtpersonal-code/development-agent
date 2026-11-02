// Deterministic plan check: every acceptance criterion has a task, every
// must-patch file is in the plan, no do-not-touch file is. Regression checks
// belong to QA's scenarios, not to the plan, so they are not required here.
const CODE_EXT = 'tsx?|jsx?|mjs|cjs|vue|svelte|cs|cshtml|razor|sql|py|java|kt|go|rb|php|html|scss|css';
// A path with a folder (any extension), or a bare code file name.
const FILE_RE = new RegExp(`([\\w.-]+(?:/[\\w.-]+)+\\.[A-Za-z]{1,6}|\\b[\\w-]+(?:\\.[\\w-]+)*\\.(?:${CODE_EXT}))\\b`, 'g');
// Labels may be written with spaces, hyphens or underscores; briefs may also
// carry the Vietnamese labels.
export const MUST = /must[\s_-]?patch|phải vá/i;
export const FORBID = /do[\s_-]?not[\s_-]?touch|không (được )?đụng/i;
// TC7 also counts as covered by TC7a / TC7b.
export const tcPattern = (id) => new RegExp(`\\b${id}[a-z]?\\b`);

export function criteriaIds(brief) {
  const section = /##[^\n]*(acceptance criteria|tiêu chí)[^\n]*\n([\s\S]*?)(?=\n## |\s*$)/i.exec(brief)?.[2] ?? brief;
  return [...new Set([...section.matchAll(/\bTC\d+\b/g)].map((m) => m[0]))];
}

export function changePointFiles(brief, re) {
  const out = [];
  for (const line of brief.split(/\r?\n/)) {
    if (!line.trim().startsWith('|') || !re.test(line)) continue;
    for (const m of line.matchAll(FILE_RE)) out.push(m[1]);
  }
  return [...new Set(out)];
}

export function planCheck({ brief, plan, outOfScopeCriteria = [] }) {
  const inPlan = (s) => plan.includes(s) || plan.includes(s.split('/').pop());
  const uncoveredCriteria = criteriaIds(brief).filter((id) => !outOfScopeCriteria.includes(id) && !tcPattern(id).test(plan));
  const missingMustPatch = changePointFiles(brief, MUST).filter((f) => !inPlan(f));
  const touchesForbidden = changePointFiles(brief, FORBID).filter((f) => f.includes('/') ? plan.includes(f) : new RegExp(`\\b${f.replace(/\./g, '\\.')}\\b`).test(plan));
  const verdict = uncoveredCriteria.length || missingMustPatch.length || touchesForbidden.length ? 'revise' : 'pass';
  return { verdict, uncoveredCriteria, missingMustPatch, touchesForbidden };
}
