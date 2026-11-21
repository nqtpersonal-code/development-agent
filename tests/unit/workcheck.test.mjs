import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmp } from '../helpers/tmp.mjs';
import { checkWork } from '../../plugin/scripts/lib/workcheck.mjs';
import { findSilenced } from '../../plugin/scripts/lib/silenced.mjs';
import { planCheck } from '../../plugin/scripts/lib/plancheck.mjs';

function work(files) {
  const d = tmp();
  for (const [f, text] of Object.entries(files)) {
    mkdirSync(join(d, f, '..'), { recursive: true });
    writeFileSync(join(d, f), text);
  }
  return d;
}

const brief = [
  '# Ticket brief', '## Acceptance criteria', '- TC1: saves', '- TC2: shows the code',
  '## Điểm cần thay đổi (Change points)', '| place | category |', '|---|---|',
  '| Students `api/src/students/students.service.ts:30` | must-patch |', '| Attendance page | must patch |', '| Invoice | Không đổi |',
  '## Open questions', '- none',
].join('\n');

test('check-work brief: categories, files of must-patch rows, open questions', () => {
  const r = checkWork(work({ 'ticket-brief.md': brief }), 'brief');
  assert.equal(r.problems.length, 2);
  assert.match(r.problems[0], /without its file.*Attendance/);
  assert.match(r.problems[1], /without a category.*Invoice/);
  const open = checkWork(work({ 'ticket-brief.md': brief.replace('- none', '- Q4: should invoices change?') }), 'brief');
  assert.ok(open.problems.some((p) => /open questions/.test(p)));
});

test('check-work analysis: required impact sections in any language, ticket kind', () => {
  const impact = '## Điểm cần thay đổi (Change points)\n| a `x.ts:1` | must patch |\n## What else this could break\nnone\n## Already in the system\nnone\n';
  const r = checkWork(work({ 'trace/impact.md': impact, 'ba.md': 'Screen design needed: no' }), 'analysis');
  assert.deepEqual(r.problems, [
    'trace/impact.md has no "Checked and rejected" section (write "none" when empty)',
    'trace/impact.md has no "Not scanned" section (write "none" when empty)',
    'ba.md does not give the ticket kind (bug / change / feature)',
  ]);
});

test('check-work test-design and qa: every criterion covered (TC1a counts for TC1), bug reproduction, results, test data', () => {
  const d = work({
    'ticket-brief.md': brief,
    'ba.md': 'Ticket kind: bug',
    'test-scenarios.md': 'TC1a … Verify by api\nTC2 … Verify by browser',
    'qa-report.md': '| TC1a | pass |\n| TC2 | shown |\n',
  });
  assert.deepEqual(checkWork(d, 'test-design').problems, ['bug ticket without a reproduction scenario P1 (prove the bug before the fix)']);
  assert.deepEqual(checkWork(d, 'qa').problems, ['TC2 has no result (pass / fail / not tested) in qa-report.md', 'qa-report.md has no "Test data" section (created / removed, or "none")']);
  assert.throws(() => checkWork(d, 'nope'), /no check for step/);
});

test('findSilenced lists added lines that switch checks off, with their new line numbers', () => {
  const diff = [
    '+++ b/web/src/App.tsx', '@@ -10,0 +11,3 @@',
    '+  // eslint-disable-next-line no-console', '+  const x = data as any;', '+  return x;',
    '+++ b/api/Svc.cs', '@@ -5 +5,2 @@', '-old', '+    try { Run(); } catch { }', '+    #pragma warning disable CS0168',
    '+++ b/api/test/a.test.ts', '@@ -1 +1 @@', '+it.skip("saves", () => {});',
  ].join('\n');
  const r = findSilenced(diff);
  assert.deepEqual(r.map((h) => `${h.file}:${h.line} ${h.kind}`), [
    'web/src/App.tsx:11 lint rule turned off', 'web/src/App.tsx:12 type escape to any',
    'api/Svc.cs:5 error swallowed (empty catch)', 'api/Svc.cs:6 .NET warning or test disabled',
    'api/test/a.test.ts:1 test skipped or focused',
  ]);
});

test('planCheck follows hyphenated labels and plain or bare file names', () => {
  const r = planCheck({ brief, plan: '### Task 1 (TC1, TC2)\nModify api/src/students/students.service.ts\n' });
  assert.equal(r.verdict, 'pass');
  const miss = planCheck({ brief: brief.replace('`api/src/students/students.service.ts:30`', '(ClassDetailPage.tsx:24)'), plan: '### Task 1 (TC1, TC2)\n' });
  assert.deepEqual(miss.missingMustPatch, ['ClassDetailPage.tsx']);
});

test('check-work analysis: every place the impact script reports is confirmed or rejected in impact.md', () => {
  const impact = [
    '## Change points', '| a `api/src/students/students.service.ts:30` | must patch |',
    '## What else this could break', 'none', '## Already in the system', 'none',
    '## Checked and rejected', '- classes.controller.ts: only lists classes',
    '## Not scanned', 'none',
  ].join('\n');
  const json = JSON.stringify({ places: [
    { file: 'api/src/students/students.service.ts', certainty: 'confirmed-uses-column' },
    { file: 'api/src/classes/classes.controller.ts', certainty: 'confirmed-uses-column' },
    { file: 'api/src/fees/fees.controller.ts', certainty: 'related-through-table' },
    { file: 'api/prisma/seed.mjs', certainty: 'confirmed-uses-column' },
    { file: 'api/src/students/students.service.spec.ts', certainty: 'confirmed-uses-column' },
  ] });
  const d = work({ 'trace/impact.md': impact, 'trace/impact.json': json, 'ba.md': 'Screen design needed: no\nTicket kind: change' });
  const r = checkWork(d, 'analysis');
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /^api\/src\/fees\/fees\.controller\.ts \(related-through-table\) .*neither confirms nor rules it out/);
});

test('check-work implement: a bug ticket needs ranked hypotheses in the implementation notes', () => {
  const bug = work({ 'ba.md': 'Ticket kind: bug', 'implementation-notes.md': '## Tasks\n- fixed the total' });
  assert.deepEqual(checkWork(bug, 'implement').problems, ['bug ticket without a "Hypotheses" section in implementation-notes.md (3–5 ranked, testable causes and what each test showed)']);
  const ok = work({ 'ba.md': 'Ticket kind: bug', 'implementation-notes.md': '## Hypotheses\n1. the discount runs twice — rejected\n2. the date is read in UTC — confirmed\n## Tasks\n- fixed' });
  assert.deepEqual(checkWork(ok, 'implement').problems, []);
  const change = work({ 'ba.md': 'Ticket kind: change', 'implementation-notes.md': '## Tasks\n- done' });
  assert.deepEqual(checkWork(change, 'implement').problems, []);
});

test('check-work questionnaire: every question has its own reply line in a Replies block', () => {
  const good = work({ 'questionnaire.md': ['# Questions for the product owner', 'Summary…', '## Q3 · Excused absences', 'Options…', '## Q5 · Refunds', 'Options…', '## Replies', 'Q3:', 'Q5:'].join('\n') });
  assert.deepEqual(checkWork(good, 'questionnaire').problems, []);
  const bad = work({ 'questionnaire.md': ['## Q3 · Excused absences', '## Q5 · Refunds', '## Replies', 'Q3:'].join('\n') });
  assert.deepEqual(checkWork(bad, 'questionnaire').problems, ['Q5 has no reply line ("Q5:") in the Replies block']);
  const noBlock = work({ 'questionnaire.md': '## Q1 · Something\nOptions…' });
  assert.ok(checkWork(noBlock, 'questionnaire').problems.some((x) => /no "Replies" block/.test(x)));
  assert.deepEqual(checkWork(work({ 'questionnaire.md': 'Just prose.' }), 'questionnaire').problems, ['questionnaire.md has no questions (Q1, Q2…)']);
});

test('findSilenced also lists temporary debugging left in the change', () => {
  const diff = ['+++ b/api/svc.ts', '@@ -3,0 +4,3 @@', '+  console.log("[NQT-DEBUG-abc] total", total);', '+  debugger;', '+  return total;', '+++ b/api/Svc.cs', '@@ -1 +1 @@', '+    Debugger.Break();'].join('\n');
  assert.deepEqual(findSilenced(diff).map((h) => `${h.file}:${h.line} ${h.kind}`), [
    'api/svc.ts:4 temporary debug log left behind',
    'api/svc.ts:5 debugger statement left behind',
    'api/Svc.cs:1 debugger statement left behind',
  ]);
});
