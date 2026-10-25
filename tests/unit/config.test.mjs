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
  assert.match(getDataDir().replace(/\\/g, '/'), /\.claude\/nqt$/);
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
  mkdirSync(join(d, 'projects', 'demo'), { recursive: true });
  writeFileSync(join(d, 'projects', 'demo', 'project.md'), '---\nlanguage: en\n---\n# demo\n');
  assert.equal(projectConfig(d, 'demo').language, 'en');
  assert.equal(projectConfig(d, 'missing').language, 'vi');
});

test('the default config carries no machine-specific paths', () => {
  const d = tmp();
  ensureDataDir(d, root);
  assert.equal(loadConfig(d).pluginSourceDir, '');
  assert.doesNotMatch(readFileSync(join(d, 'config.md'), 'utf8'), /[A-Za-z]:\\Users|\/home\//);
});
