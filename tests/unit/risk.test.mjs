import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmp } from '../helpers/tmp.mjs';
import { gitHistory, testCoverage } from '../../plugin/scripts/lib/risk.mjs';

function repo() {
  const root = tmp();
  const git = (...a) => execFileSync('git', a, { cwd: root, stdio: 'pipe' });
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  mkdirSync(join(root, 'src'));
  const commit = (content, msg) => {
    writeFileSync(join(root, 'src', 'fee.ts'), content);
    git('add', '.');
    git('commit', '-q', '-m', msg);
  };
  commit('v1', 'feat: fee rule');
  commit('v2', 'fix: wrong discount');
  commit('v3', 'fix(fee): rounding');
  commit('v4', 'chore: tidy');
  return root;
}

test('gitHistory counts changes and bug-fix commits for a file', () => {
  const root = repo();
  const h = gitHistory(root, 'src/fee.ts', { days: 3650 });
  assert.equal(h.commits, 4);
  assert.equal(h.fixCommits, 2);
  assert.ok(h.lastChanged);
});

test('gitHistory outside a git repo reports unknown instead of failing', () => {
  const h = gitHistory(tmp(), 'x.ts');
  assert.equal(h.commits, null);
});

test('testCoverage lists test files that mention a symbol or route', () => {
  const root = tmp();
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'test'));
  writeFileSync(join(root, 'src', 'fees.service.ts'), 'total() {}');
  writeFileSync(join(root, 'test', 'fees.spec.ts'), "it('total', () => service.total(20, 1));");
  writeFileSync(join(root, 'src', 'other.test.ts'), "request(app).get('/api/fees/1/invoice')");
  const c = testCoverage([root], ['total', '/api/fees/:studentId/invoice']);
  assert.deepEqual(c.files.sort(), ['src/other.test.ts', 'test/fees.spec.ts']);
  assert.deepEqual(testCoverage([root], ['nothingHere']).files, []);
});
