import { test } from 'node:test';
import assert from 'node:assert/strict';
import { riskLevel } from '../../plugin/scripts/lib/risk.mjs';

test('a small smell gets a quick question', () => {
  const r = riskLevel({ copies: 2, routes: 1, screens: 1, fixCommits: 0, dataChange: false });
  assert.equal(r.level, 'quick');
});

test('many copies, a wide radius, frequent bug fixes or data changes need the full analysis', () => {
  assert.equal(riskLevel({ copies: 3, routes: 1, screens: 1, fixCommits: 0 }).level, 'full');
  assert.equal(riskLevel({ copies: 2, routes: 3, screens: 2, fixCommits: 0 }).level, 'full');
  assert.equal(riskLevel({ copies: 2, routes: 1, screens: 1, fixCommits: 2 }).level, 'full');
  const d = riskLevel({ copies: 2, routes: 1, screens: 1, fixCommits: 0, dataChange: true });
  assert.equal(d.level, 'full');
  assert.match(d.reasons.join(' '), /data/);
});

test('unknown history does not force the full analysis', () => {
  assert.equal(riskLevel({ copies: 2, routes: 1, screens: 0, fixCommits: null }).level, 'quick');
});
