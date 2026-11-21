import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmp } from '../helpers/tmp.mjs';
import { newState, writeState, readState } from '../../plugin/scripts/lib/state.mjs';
import { runAutopilot, claudeCommand, sessionPrompt } from '../../plugin/scripts/lib/autopilot.mjs';

// A stand-in for `claude -p`: each call moves the ticket on according to FAKE_MODE and
// prints the JSON summary the real CLI prints.
const FAKE = `
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const work = process.env.FAKE_WORK;
const file = join(work, 'state.json');
const s = JSON.parse(readFileSync(file, 'utf8'));
const order = ['setup','analysis','screens','risk','brief','test-design','free-qa','architect','design','plan','plan-check','implement','review','qa','report'];
const mode = process.env.FAKE_MODE;
if (process.env.NQT_AUTOPILOT !== '1') { console.log(JSON.stringify({ is_error: true, result: 'not autopilot' })); process.exit(0); }
if (mode === 'progress' || mode === 'cost') {
  for (let k = 0; k < 4; k++) { const next = order.find((x) => s.steps[x] === 'pending'); if (next) s.steps[next] = 'done'; }
  s.current = order.find((x) => s.steps[x] === 'pending') || 'done';
}
if (mode === 'redline') s.waitingFor = { kind: 'question', text: 'Q2 (red line: how fees are calculated)', since: 'x' };
writeFileSync(file, JSON.stringify(s));
if (mode === 'crash') { console.error('boom'); process.exit(1); }
console.log(JSON.stringify({ is_error: false, result: 'ok', total_cost_usd: mode === 'cost' ? 6 : 0.5 }));
`;

function setup(mode) {
  const dir = tmp();
  const fake = join(dir, 'fake-claude.cjs');
  writeFileSync(fake, FAKE);
  const work = join(dir, 'work');
  writeState(work, newState('p', '7'));
  process.env.FAKE_WORK = work;
  process.env.FAKE_MODE = mode;
  return { work, claude: `node "${fake}"`, root: dir };
}

test('runs fresh sessions until the ticket is done, and logs each one', () => {
  const { work, claude, root } = setup('progress');
  const lines = [];
  const r = runAutopilot({ root, work, ticket: '7', claude, onSession: (l) => lines.push(l) });
  assert.equal(r.reason, 'finished');
  assert.equal(r.sessions, 4);
  assert.equal(r.cost, 2);
  assert.equal(readState(work).current, 'done');
  assert.equal(lines.length, 4);
});

test('stops and waits for the owner at a red line', () => {
  const { work, claude, root } = setup('redline');
  const r = runAutopilot({ root, work, ticket: '7', claude });
  assert.equal(r.reason, 'needs-owner');
  assert.match(r.detail, /red line/);
  assert.equal(r.sessions, 1);
});

test('stops at the cost cap, when stuck, and on a failed session', () => {
  let s = setup('cost');
  assert.deepEqual([runAutopilot({ ...s, ticket: '7', maxCostUsd: 10 }).reason, runAutopilot({ ...setup('cost'), ticket: '7', maxCostUsd: 10 }).sessions], ['cost-cap', 2]);
  s = setup('idle');
  const stuck = runAutopilot({ ...s, ticket: '7' });
  assert.equal(stuck.reason, 'stuck');
  assert.equal(stuck.sessions, 2);
  s = setup('crash');
  assert.equal(runAutopilot({ ...s, ticket: '7' }).reason, 'error');
});

test('sessions run the skill in autopilot and can never push or open a pull request', () => {
  const cmd = claudeCommand({ model: 'sonnet' });
  assert.match(cmd, /-p --output-format json --model sonnet/);
  for (const d of ['Bash(git push:*)', 'PowerShell(git push:*)', 'Bash(gh pr create:*)', 'Bash(glab mr create:*)']) assert.ok(cmd.includes(`"${d}"`), d);
  assert.match(sessionPrompt({ ticket: '7', project: 'shop' }), /nqt:work-ticket" and args "shop 7 --auto"/);
});
