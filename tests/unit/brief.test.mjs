import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmp } from '../helpers/tmp.mjs';
import { briefSkeleton, parseAnswers, addOwnerAnswers } from '../../plugin/scripts/lib/brief.mjs';
import { planCheck } from '../../plugin/scripts/lib/plancheck.mjs';

test('addOwnerAnswers appends under Owner answers and keeps the sections after it', () => {
  const brief = '## 3. Acceptance criteria\n- TC1\n\n## 8. Owner answers\n\n- Q1 → keep (2026-01-01)\n\n## 9. Open questions\n- none\n';
  const out = addOwnerAnswers(brief, [{ q: 'Q2', a: 'Hiện mã học sinh' }], '2026-01-02');
  assert.match(out, /- Q1 → keep \(2026-01-01\)\n- Q2 → Hiện mã học sinh \(2026-01-02\)\n\n## 9\. Open questions\n- none\n$/);
  const fresh = addOwnerAnswers(briefSkeleton(), [{ q: 'Q1', a: 'yes' }], '2026-01-02');
  assert.match(fresh, /## 8\. Owner answers\n\n- Q1 → yes \(2026-01-02\)\n\n## 9\. Open questions/);
  assert.equal(planCheck({ brief: fresh, plan: '' }).verdict, 'pass');
  assert.match(addOwnerAnswers('# Brief\n', [{ q: 'Q1', a: 'x' }], 'd'), /## Owner answers\n\n- Q1 → x \(d\)\n$/);
});

test('parseAnswers reads "Q1: answer" and "Q1 → answer" lines only', () => {
  assert.deepEqual(parseAnswers('Q1: Cho phép trùng tên\n- Q2 → no\nnote\n'), [{ q: 'Q1', a: 'Cho phép trùng tên' }, { q: 'Q2', a: 'no' }]);
});

test('answer command records owner answers without the lead reading the brief', async () => {
  const { main } = await import('../../plugin/scripts/nqt.mjs');
  const d = tmp();
  const log = console.log;
  console.log = () => {};
  try {
    assert.equal(await main(['answer', d, '--q', 'Q1', '--a', 'yes', '--q', 'Q2', '--a', 'no']), 0);
    writeFileSync(join(d, 'a.md'), 'Q3: Hiện ở cả hai màn hình\n', 'utf8');
    assert.equal(await main(['answer', d, '--file', join(d, 'a.md')]), 0);
    assert.equal(await main(['answer', d, '--q', 'Q4']), 1);
  } finally {
    console.log = log;
  }
  assert.ok(existsSync(join(d, 'ticket-brief.md')));
  assert.match(readFileSync(join(d, 'ticket-brief.md'), 'utf8'), /- Q1 → yes .*\n- Q2 → no .*\n- Q3 → Hiện ở cả hai màn hình /);
});
