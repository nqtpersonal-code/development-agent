import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => JSON.parse(readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8'));

test('marketplace points to the nqt plugin in ./plugin', () => {
  const m = read('.claude-plugin/marketplace.json');
  assert.equal(m.name, 'nqt-local');
  assert.equal(m.plugins[0].name, 'nqt');
  assert.equal(m.plugins[0].source, './plugin');
});

test('plugin manifest is named nqt with a semver version', () => {
  const p = read('plugin/.claude-plugin/plugin.json');
  assert.equal(p.name, 'nqt');
  assert.match(p.version, /^\d+\.\d+\.\d+$/);
});
