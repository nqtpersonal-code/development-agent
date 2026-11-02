import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { criteriaIds, changePointFiles, MUST, FORBID, tcPattern } from './plancheck.mjs';

// Definition of done for each step's work files, checked by script so an agent
// that skipped part of its job is sent back before anyone builds on its output.
// Section headings and category labels stay in English in every language (see
// formats.md), so these checks do not depend on the owner's language.
const read = (work, f) => (existsSync(join(work, f)) ? readFileSync(join(work, f), 'utf8') : null);
const heading = (text, re) => new RegExp(`^#{1,6}[^\\n]*${re.source}`, 'im').test(text) || new RegExp(`\\*\\*${re.source}`, 'i').test(text);
const CATEGORY = new RegExp(`${MUST.source}|${FORBID.source}|re[\\s_-]?check|kiểm lại`, 'i');
const FILE_REF = /\.[A-Za-z]{1,6}(?::|#L)\d+/;
const RESULT = /\b(pass(ed)?|fail(ed)?|not tested|cannot verify)\b|đạt|không đạt|chưa kiểm/i;

function section(text, re) {
  const m = new RegExp(`^(#{1,6})[^\\n]*${re.source}[^\\n]*\\n`, 'im').exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const end = rest.search(new RegExp(`^#{1,${m[1].length}} `, 'm'));
  return end === -1 ? rest : rest.slice(0, end);
}

const tableRows = (text) => (text ?? '').split(/\r?\n/).filter((l) => /^\s*\|/.test(l) && !/^\s*\|[\s:|-]+\|\s*$/.test(l));

function needFile(work, f, problems) {
  const t = read(work, f);
  if (t === null) problems.push(`${f} is missing`);
  else if (!t.trim()) problems.push(`${f} is empty`);
  return t;
}

const CHECKS = {
  analysis(work, p) {
    const impact = needFile(work, 'trace/impact.md', p);
    if (impact) {
      for (const [name, re] of [['Change points', /change points/], ['What else this could break', /what else this could break/], ['Already in the system', /already in the system/], ['Not scanned', /not scanned/]]) {
        if (!heading(impact, re)) p.push(`trace/impact.md has no "${name}" section (write "none" when empty)`);
      }
      for (const row of tableRows(impact).filter((r) => MUST.test(r))) {
        if (!FILE_REF.test(row)) p.push(`must-patch row without a file:line link: ${row.trim().slice(0, 100)}`);
      }
    }
    const ba = needFile(work, 'ba.md', p);
    if (ba) {
      if (!/screen design needed/i.test(ba)) p.push('ba.md does not say whether screen design is needed');
      if (!/ticket kind/i.test(ba)) p.push('ba.md does not give the ticket kind (bug / change / feature)');
    }
  },
  brief(work, p) {
    const brief = needFile(work, 'ticket-brief.md', p);
    if (!brief) return;
    if (!criteriaIds(brief).length) p.push('ticket-brief.md has no acceptance criteria TC1…TCn');
    const cp = section(brief, /change points/);
    if (cp === null) p.push('ticket-brief.md has no Change points section');
    else for (const row of tableRows(cp).slice(1)) {
      if (!CATEGORY.test(row)) p.push(`change point without a category (must patch / do not touch / re-check): ${row.trim().slice(0, 100)}`);
      else if (MUST.test(row) && !changePointFiles(row, MUST).length) p.push(`must-patch change point without its file (the plan check cannot follow it): ${row.trim().slice(0, 100)}`);
    }
    const open = section(brief, /open questions/);
    if (open && open.split(/\r?\n/).some((l) => /^\s*[-*\d]/.test(l) && !/\b(none|n\/a)\b|không có/i.test(l))) p.push('ticket-brief.md still has open questions');
  },
  'test-design'(work, p) {
    const scenarios = needFile(work, 'test-scenarios.md', p);
    const brief = read(work, 'ticket-brief.md') ?? '';
    if (!scenarios) return;
    for (const id of criteriaIds(brief)) if (!tcPattern(id).test(scenarios)) p.push(`${id} has no test scenario`);
    if (/ticket kind[^\n]*\bbug\b/i.test(read(work, 'ba.md') ?? '') && !/\bP\d+\b/.test(scenarios)) p.push('bug ticket without a reproduction scenario P1 (prove the bug before the fix)');
  },
  implement(work, p) {
    needFile(work, 'implementation-notes.md', p);
  },
  review(work, p) {
    const review = needFile(work, 'review.md', p);
    if (review && !/critical|important|minor|no findings/i.test(review)) p.push('review.md has no severity for its findings (or "no findings")');
  },
  qa(work, p) {
    const report = needFile(work, 'qa-report.md', p);
    if (!report) return;
    const lines = report.split(/\r?\n/);
    for (const id of criteriaIds(read(work, 'ticket-brief.md') ?? '')) {
      const hit = lines.filter((l) => tcPattern(id).test(l));
      if (!hit.length) p.push(`${id} is not in qa-report.md`);
      else if (!hit.some((l) => RESULT.test(l))) p.push(`${id} has no result (pass / fail / not tested) in qa-report.md`);
    }
    if (!heading(report, /test data/)) p.push('qa-report.md has no "Test data" section (created / removed, or "none")');
  },
};

export const CHECKED_STEPS = Object.keys(CHECKS);

export function checkWork(work, step) {
  const check = CHECKS[step];
  if (!check) throw new Error(`no check for step "${step}" (have: ${CHECKED_STEPS.join(', ')})`);
  const problems = [];
  check(work, problems);
  return { step, problems };
}
