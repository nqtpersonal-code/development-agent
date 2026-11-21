import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmp } from '../helpers/tmp.mjs';
import { stampCode, changesSinceStamp } from '../../plugin/scripts/lib/stamp.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.email=t@example.org', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
};

function repo() {
  const root = tmp();
  git(root, 'init', '-q', '-b', 'main');
  mkdirSync(join(root, 'api'), { recursive: true });
  writeFileSync(join(root, 'api', 'fees.service.ts'), 'a\nb\n');
  writeFileSync(join(root, 'api', 'other.ts'), 'x\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  const work = tmp();
  mkdirSync(join(work, 'trace'), { recursive: true });
  writeFileSync(join(work, 'trace', 'impact.md'), 'The fee rule: [fees.service.ts:2](api/fees.service.ts#L2)\n');
  return { root, work };
}

test('no stamp, nothing to compare', () => {
  const { root, work } = repo();
  assert.deepEqual(changesSinceStamp(work, root), { stamped: false, repos: [] });
});

test('unchanged code reports nothing; a change to an uncited file is "moved"; a change to a cited file is named', () => {
  const { root, work } = repo();
  stampCode(work, root);
  assert.deepEqual(changesSinceStamp(work, root).repos, []);
  writeFileSync(join(root, 'api', 'other.ts'), 'y\n');
  git(root, 'commit', '-q', '-am', 'other');
  assert.deepEqual(changesSinceStamp(work, root).repos, [{ dir: '.', unknown: false, moved: 1, cited: [] }]);
  writeFileSync(join(root, 'api', 'fees.service.ts'), 'a\nc\n');
  git(root, 'commit', '-q', '-am', 'fees');
  assert.deepEqual(changesSinceStamp(work, root).repos, [{ dir: '.', unknown: false, moved: 2, cited: ['api/fees.service.ts'] }]);
});

test('an analysed commit that no longer exists is reported as unknown', () => {
  const { root, work } = repo();
  writeFileSync(join(work, 'trace', 'stamp.json'), JSON.stringify({ takenAt: 'x', repos: { '.': '0123456789012345678901234567890123456789' } }));
  assert.deepEqual(changesSinceStamp(work, root).repos, [{ dir: '.', unknown: true, moved: 0, cited: [] }]);
});
