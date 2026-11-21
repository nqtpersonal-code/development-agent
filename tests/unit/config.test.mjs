import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp, pluginRoot } from '../helpers/tmp.mjs';
import { getDataDir, ensureDataDir, loadConfig, projectConfig } from '../../plugin/scripts/lib/config.mjs';

const root = fileURLToPath(pluginRoot);

test('getDataDir honours NQT_DATA_DIR', () => {
  const d = tmp();
  process.env.NQT_DATA_DIR = d;
  assert.equal(getDataDir(), d);
  delete process.env.NQT_DATA_DIR;
});

test('getDataDir defaults to ~/.nqt and moves data from ~/.claude/nqt once', () => {
  const fresh = tmp();
  assert.equal(getDataDir({ home: fresh, env: {} }), join(fresh, '.nqt'));
  const home = tmp();
  mkdirSync(join(home, '.claude', 'nqt', 'projects'), { recursive: true });
  writeFileSync(join(home, '.claude', 'nqt', 'config.md'), 'mine');
  assert.equal(getDataDir({ home, env: {} }), join(home, '.nqt'));
  assert.equal(readFileSync(join(home, '.nqt', 'config.md'), 'utf8'), 'mine');
  assert.ok(!existsSync(join(home, '.claude', 'nqt')));
  assert.equal(getDataDir({ home, env: { NQT_DATA_DIR: 'X' } }), 'X');
});

test('ensureDataDir creates the layout once and never overwrites config', () => {
  const d = tmp();
  const first = ensureDataDir(d, root);
  for (const p of ['config.md', 'projects', 'work', 'patterns', 'review-rules', 'runtime']) {
    assert.ok(existsSync(join(d, p)), p);
  }
  assert.ok(first.created.length >= 6);
  writeFileSync(join(d, 'config.md'), '---\nlanguage: en\n---\n');
  const second = ensureDataDir(d, root);
  assert.deepEqual(second.created, []);
  assert.equal(readFileSync(join(d, 'config.md'), 'utf8'), '---\nlanguage: en\n---\n');
});

test('ensureDataDir copies starter patterns that are absent', () => {
  const d = tmp();
  ensureDataDir(d, root);
  assert.ok(existsSync(join(d, 'patterns', 'dense-form-mobile', 'index.md')));
});

test('loadConfig defaults to vi and parses nicknames', () => {
  const d = tmp();
  ensureDataDir(d, root);
  assert.equal(loadConfig(d).language, 'vi');
  writeFileSync(join(d, 'config.md'), '---\nlanguage: en\nnicknames:\n  agents:\n    ba: Mai\n  steps:\n    analysis: Soi ticket\n---\n');
  const c = loadConfig(d);
  assert.equal(c.language, 'en');
  assert.equal(c.nicknames.agents.ba, 'Mai');
  assert.equal(c.nicknames.steps.analysis, 'Soi ticket');
});

test('project language override wins', () => {
  const d = tmp();
  ensureDataDir(d, root);
  mkdirSync(join(d, 'projects', 'sample'), { recursive: true });
  writeFileSync(join(d, 'projects', 'sample', 'project.md'), '---\nlanguage: en\n---\n# sample\n');
  assert.equal(projectConfig(d, 'sample').language, 'en');
  assert.equal(projectConfig(d, 'missing').language, 'vi');
});

test('the default config carries no machine-specific paths', () => {
  const d = tmp();
  ensureDataDir(d, root);
  assert.equal(loadConfig(d).pluginSourceDir, '');
  assert.doesNotMatch(readFileSync(join(d, 'config.md'), 'utf8'), /[A-Za-z]:\\Users|\/home\//);
});

test('designBias defaults to ask, accepts extensible and minimal, and a project can override it', async () => {
  const { loadConfig, projectConfig } = await import('../../plugin/scripts/lib/config.mjs');
  const { mkdirSync: mk, writeFileSync: wf } = await import('node:fs');
  const { join: j } = await import('node:path');
  const { tmp: t } = await import('../helpers/tmp.mjs');
  const d = t();
  assert.equal(loadConfig(d).designBias, 'ask');
  wf(j(d, 'config.md'), '---\ndesignBias: minimal\n---\n');
  assert.equal(loadConfig(d).designBias, 'minimal');
  mk(j(d, 'projects', 'p'), { recursive: true });
  wf(j(d, 'projects', 'p', 'project.md'), '---\ndesignBias: extensible\n---\n');
  assert.equal(projectConfig(d, 'p').designBias, 'extensible');
  wf(j(d, 'config.md'), '---\ndesignBias: nonsense\n---\n');
  assert.equal(loadConfig(d).designBias, 'ask');
});

test('structure-choice records one dated line per decision and creates the file with its header', async () => {
  const { addChoice, choicesFile } = await import('../../plugin/scripts/lib/choices.mjs');
  const { readFileSync: rd } = await import('node:fs');
  const { tmp: t2 } = await import('../helpers/tmp.mjs');
  const d = t2();
  addChoice({ dataDir: d, project: 'p', ticket: 7, area: 'fee discounts', choice: 'Strategy registry', why: 'more discount kinds are planned', date: '2026-11-20' });
  addChoice({ dataDir: d, project: 'p', ticket: 9, area: 'reminders', choice: 'direct', date: '2026-11-21' });
  const text = rd(choicesFile(d, 'p'), 'utf8');
  assert.match(text, /^# Structure choices/);
  assert.match(text, /- 2026-11-20 · ticket 7 · fee discounts → Strategy registry — more discount kinds are planned\n/);
  assert.match(text, /- 2026-11-21 · ticket 9 · reminders → direct\n/);
  assert.throws(() => addChoice({ dataDir: d, project: 'p', ticket: 1, area: '', choice: 'x' }), /needs --area and --choice/);
});
