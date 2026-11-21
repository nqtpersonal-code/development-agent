import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { criteriaIds, changePointFiles, MUST, FORBID, tcPattern } from './plancheck.mjs';
import { checkLinks } from './links.mjs';

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

// Places the impact script found that the map neither confirms nor rules out.
// Seeds, fixtures and tests are left to the agent's judgement.
const MINOR = /(^|\/)(seeds?|fixtures?|__tests__|tests?|specs?)(\/|\.)|\.(test|spec)\.[a-z]+$/i;
function unaccounted(work, impact) {
  const dir = join(work, 'trace');
  if (!existsSync(dir)) return [];
  const doc = impact.toLowerCase().replaceAll('\\', '/');
  const missing = new Map();
  for (const f of readdirSync(dir).filter((n) => /^impact(-.+)?\.json$/.test(n))) {
    let places;
    try {
      places = JSON.parse(readFileSync(join(dir, f), 'utf8')).places ?? [];
    } catch {
      continue;
    }
    for (const pl of places) {
      const file = String(pl.file ?? '').replaceAll('\\', '/');
      if (!file || MINOR.test(file) || missing.has(file)) continue;
      if (!doc.includes(file.toLowerCase()) && !doc.includes(file.split('/').pop().toLowerCase())) missing.set(file, pl);
    }
  }
  const list = [...missing.entries()];
  return list.slice(0, 6).map(([file, pl]) => `${file} (${pl.certainty ?? 'candidate'}) is in the impact script's results but impact.md neither confirms nor rules it out: add it as a place, or under "Checked and rejected" with the reason`)
    .concat(list.length > 6 ? [`…and ${list.length - 6} more places from impact.json that impact.md does not mention`] : []);
}

const CHECKS = {
  analysis(work, p) {
    const impact = needFile(work, 'trace/impact.md', p);
    if (impact) {
      for (const [name, re] of [['Change points', /change points/], ['What else this could break', /what else this could break/], ['Already in the system', /already in the system/], ['Checked and rejected', /checked and rejected/], ['Not scanned', /not scanned/]]) {
        if (!heading(impact, re)) p.push(`trace/impact.md has no "${name}" section (write "none" when empty)`);
      }
      for (const row of tableRows(impact).filter((r) => MUST.test(r))) {
        if (!FILE_REF.test(row)) p.push(`must-patch row without a file:line link: ${row.trim().slice(0, 100)}`);
      }
      unaccounted(work, impact).forEach((x) => p.push(x));
    }
    const ba = needFile(work, 'ba.md', p);
    if (ba) {
      if (!/screen design needed/i.test(ba)) p.push('ba.md does not say whether screen design is needed');
      if (!/ticket kind/i.test(ba)) p.push('ba.md does not give the ticket kind (bug / change / feature)');
      if (!/fast path/i.test(ba)) p.push('ba.md does not say whether the short path is eligible (Fast path: eligible / not eligible, with why)');
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
    const notes = needFile(work, 'implementation-notes.md', p);
    // A bug is fixed after its cause is known: ranked hypotheses, each tested, come first.
    if (notes && /ticket kind[^\n]*\bbug\b/i.test(read(work, 'ba.md') ?? '') && !/hypothes[ei]s/i.test(notes)) {
      p.push('bug ticket without a "Hypotheses" section in implementation-notes.md (3–5 ranked, testable causes and what each test showed)');
    }
  },
  // The questions for someone else: every question the owner could not decide has its
  // own reply line, so the answers can be pasted back and recorded.
  questionnaire(work, p) {
    const q = needFile(work, 'questionnaire.md', p);
    if (!q) return;
    const ids = [...new Set([...q.matchAll(/\bQ(\d+)\b/g)].map((m) => m[1]))];
    if (!ids.length) return void p.push('questionnaire.md has no questions (Q1, Q2…)');
    const replies = q.slice(Math.max(0, q.search(/^#{1,6}[^\n]*repl(y|ies)/im)));
    if (!/^#{1,6}[^\n]*repl(y|ies)/im.test(q)) p.push('questionnaire.md has no "Replies" block to paste the answers back into');
    for (const id of ids) if (!new RegExp(`^\\s*Q${id}\\s*:`, 'm').test(replies)) p.push(`Q${id} has no reply line ("Q${id}:") in the Replies block`);
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

// Work files whose evidence links are checked against the project, per step.
const LINK_FILES = {
  analysis: ['trace/impact.md', 'ba.md'],
  brief: ['ticket-brief.md'],
  review: ['review.md'],
  qa: ['qa-report.md'],
};

// With `root` (the project folder) the evidence links in the step's files are checked too.
export function checkWork(work, step, { root } = {}) {
  const check = CHECKS[step];
  if (!check) throw new Error(`no check for step "${step}" (have: ${CHECKED_STEPS.join(', ')})`);
  const problems = [];
  check(work, problems);
  if (root && LINK_FILES[step]) problems.push(...checkLinks({ work, root, files: LINK_FILES[step] }));
  return { step, problems };
}
