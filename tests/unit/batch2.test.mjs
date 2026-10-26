// nqt-leak-scan: ignore-file  (fictional fixture DB urls)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp } from '../helpers/tmp.mjs';
import { newState, writeState, setWaiting, resumeState, readState } from '../../plugin/scripts/lib/state.mjs';
import { agentBrief, AGENT_SECTIONS } from '../../plugin/scripts/lib/docs.mjs';
import { planCheck } from '../../plugin/scripts/lib/plancheck.mjs';
import { setupDetect } from '../../plugin/scripts/lib/setup.mjs';
import { classifySql, runSql } from '../../plugin/scripts/lib/sql.mjs';
import { getDataDir } from '../../plugin/scripts/lib/config.mjs';

const fx = fileURLToPath(new URL('../fixtures/', import.meta.url));
const plugin = fileURLToPath(new URL('../../plugin/', import.meta.url));

test('waiting accepts only owner-facing kinds, and resume drops any /clear reminder', () => {
  const d = tmp();
  writeState(d, newState('sample', '1'));
  assert.throws(() => setWaiting(d, { kind: 'agent', text: 'waiting for reviewer' }), /kind/);
  setWaiting(d, { kind: 'clear', text: '' });
  assert.equal(resumeState(d).waitingFor, null);
  setWaiting(d, { kind: 'approval', text: 'Duyệt hồ sơ?' });
  assert.equal(resumeState(d).waitingFor.kind, 'approval');
  assert.equal(readState(d).waitingFor.kind, 'approval');
});

test('agentBrief returns every rule and format section an agent needs in one text', () => {
  const t = agentBrief(plugin, 'qa');
  assert.match(t, /## Local DB guard/);
  assert.match(t, /## Ticket work files/);
  assert.doesNotMatch(t, /## Confidentiality/);
  for (const a of Object.keys(AGENT_SECTIONS)) assert.ok(agentBrief(plugin, a).length > 200, a);
  assert.throws(() => agentBrief(plugin, 'nobody'), /unknown agent/);
});

test('planCheck reports uncovered criteria, missing must-patch files and touched forbidden files', () => {
  const brief = [
    '## Acceptance criteria', '- TC1: duplicate names save', '- TC2: list shows codes', '- TC3: attendance shows code',
    '## Change points',
    '| place | category |', '|---|---|',
    '| students service [students.service.ts](api/src/students/students.service.ts) | must patch |',
    '| attendance page `web/src/pages/AttendancePage.tsx` | phải vá |',
    '| fee invoice `api/src/fees/fees.service.ts` | do not touch |',
  ].join('\n');
  const plan = '### Task 1 (TC1)\nModify: `api/src/students/students.service.ts`\n### Task 2 (TC2)\nModify: `api/src/fees/fees.service.ts`\n';
  const r = planCheck({ brief, plan });
  assert.deepEqual(r.uncoveredCriteria, ['TC3']);
  assert.deepEqual(r.missingMustPatch, ['web/src/pages/AttendancePage.tsx']);
  assert.deepEqual(r.touchesForbidden, ['api/src/fees/fees.service.ts']);
  assert.equal(r.verdict, 'revise');
  const ok = planCheck({ brief, plan: '### Task 1 (TC1, TC2, TC3)\n`api/src/students/students.service.ts`\n`web/src/pages/AttendancePage.tsx`\n' });
  assert.equal(ok.verdict, 'pass');
});

test('setupDetect gathers DB candidates, scripts, components and test habits in one pass', () => {
  const r = setupDetect(join(fx, 'school-a'));
  const db = r.db.find((x) => x.file === 'api/.env');
  assert.equal(db.engine, 'postgres');
  assert.equal(db.host, 'localhost');
  assert.equal(db.local, true);
  assert.equal(JSON.stringify(r).includes('school:school'), false, 'never echoes passwords');
  assert.ok(r.components.some((c) => c.root === 'web' && c.kind === 'fe'));
  assert.equal(r.scripts.web.dev, 'vite --port 5173 --strictPort');
  assert.equal(r.tests.files, 0);
  assert.equal(r.tests.writeTestsGuess, 'no');
});

test('classifySql tells reads from writes', () => {
  assert.equal(classifySql('SELECT * FROM students'), 'read');
  assert.equal(classifySql('  with x as (select 1) select * from x'), 'read');
  assert.equal(classifySql('INSERT INTO students (full_name) VALUES ($1)'), 'write');
  assert.equal(classifySql('select 1; delete from students'), 'write');
});

test('wholeTableWrites flags writes that would touch every row', async () => {
  const { wholeTableWrites } = await import('../../plugin/scripts/lib/sql.mjs');
  assert.deepEqual(wholeTableWrites("DELETE FROM students WHERE id = 7"), []);
  assert.deepEqual(wholeTableWrites("UPDATE students SET phone = NULL WHERE id IN (7, 8)"), []);
  assert.equal(wholeTableWrites('delete from students').length, 1);
  assert.equal(wholeTableWrites("update students set phone = null; delete from fees where id = 1").length, 1);
  assert.equal(wholeTableWrites('TRUNCATE attendance').length, 1);
  assert.deepEqual(wholeTableWrites('select * from students'), []);
});

test('runSql reads the fixture DB without exposing the connection string', async (t) => {
  let r;
  try {
    r = await runSql({ url: 'postgresql://school:school@localhost:55432/school_a', query: 'SELECT count(*)::int AS n FROM students', dataDir: getDataDir() });
  } catch (e) {
    t.skip(`fixture DB not reachable: ${e.message}`);
    return;
  }
  assert.ok(r.rows[0].n >= 5);
  await assert.rejects(runSql({ url: 'postgresql://school:school@localhost:55432/school_a', query: 'DELETE FROM students WHERE 1=0', dataDir: getDataDir() }), /--write/);
});

test('guide prints only the current step, and dev steps carry the owner preferences', async () => {
  const { stepGuide } = await import('../../plugin/scripts/lib/docs.mjs');
  const { STEPS } = await import('../../plugin/scripts/lib/state.mjs');
  for (const s of [...STEPS, 'build-adapter', 'doubt', 'dev-rules']) assert.match(stepGuide(plugin, s), new RegExp(`^## ${s}\\b`, 'm'), s);
  const analysis = stepGuide(plugin, 'analysis');
  assert.doesNotMatch(analysis, /^## (screens|plan)\b/m);
  assert.match(stepGuide(plugin, 'implement'), /^## dev-rules/m);
  assert.doesNotMatch(stepGuide(plugin, 'review'), /^## dev-rules/m);
  assert.throws(() => stepGuide(plugin, 'nope'), /no guide/);
});

test('judgeApp tells a current app from a stale one or one from another folder', async () => {
  const { judgeApp } = await import('../../plugin/scripts/lib/appcheck.mjs');
  const root = 'C:\\work\\ticket-3';
  const later = new Date('2026-01-02T00:00:00Z');
  assert.equal(judgeApp({ port: 1, owner: null, root }).status, 'free');
  assert.equal(judgeApp({ port: 1, owner: { pid: 2, commandLine: 'node C:/work/ticket-2/api/dist/main.js', startedAt: '2026-01-01T00:00:00Z' }, root, newestChange: later }).status, 'other-folder');
  assert.equal(judgeApp({ port: 1, owner: { pid: 2, commandLine: 'node C:/work/ticket-3/api/dist/main.js', startedAt: '2026-01-01T00:00:00Z' }, root, newestChange: later }).status, 'stale');
  assert.equal(judgeApp({ port: 1, owner: { pid: 2, commandLine: 'node C:\\work\\ticket-3\\web\\node_modules\\vite\\bin\\vite.js', startedAt: '2026-01-01T00:00:00Z' }, root, newestChange: later }).status, 'current');
  for (const commandLine of ['node dist/main.js', '"C:\\Program Files\\nodejs\\node.exe" dist/main.js']) {
    assert.equal(judgeApp({ port: 1, owner: { pid: 2, commandLine, startedAt: '2026-01-01T00:00:00Z' }, root, newestChange: later }).status, 'unknown', commandLine);
  }
  assert.equal(judgeApp({ port: 1, owner: { pid: 2, commandLine: 'node dist/main.js', cwd: 'C:/work/ticket-3/api', startedAt: '2026-01-02T01:00:00Z' }, root, newestChange: later }).status, 'current');
});

test('state --set at a phase boundary tells the lead to stop for /clear', async () => {
  const { main } = await import('../../plugin/scripts/nqt.mjs');
  const d = tmp();
  writeState(d, newState('sample', '1'));
  const out = [];
  const log = console.log;
  console.log = (...a) => out.push(a.join(' '));
  try {
    await main(['state', d, '--set', 'setup=done']);
    assert.doesNotMatch(out.join('\n'), /boundary/);
    await main(['state', d, '--set', 'plan-check=done']);
    assert.match(out.join('\n'), /boundary: suggest \/clear now.*END your turn/);
  } finally {
    console.log = log;
  }
});
