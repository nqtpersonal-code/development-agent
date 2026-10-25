// nqt-leak-scan: ignore-file  (fictional remotes)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmp } from '../helpers/tmp.mjs';
import { listRepos, resolveComponents } from '../../plugin/scripts/lib/workspace.mjs';
import { resolveProject, rememberProject } from '../../plugin/scripts/lib/project-id.mjs';

function workspace() {
  const root = tmp('nqt-ws-');
  for (const [dir, remote] of [['be', 'git@git.example.org:shop/backend.git'], ['fe', 'https://git.example.org/shop/frontend.git']]) {
    mkdirSync(join(root, dir));
    execFileSync('git', ['init', '-q'], { cwd: join(root, dir) });
    execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: join(root, dir) });
  }
  mkdirSync(join(root, 'notes'));
  return root;
}

test('listRepos finds the repos inside a ticket folder with their remotes', () => {
  const repos = listRepos(workspace());
  assert.deepEqual(repos.map((r) => [r.dir, r.repo]), [['be', 'shop/backend'], ['fe', 'shop/frontend']]);
});

test('a workspace of two repos needs one shared name, then every ticket folder resolves to it', () => {
  const data = tmp();
  const ws1 = workspace();
  const first = resolveProject({ root: ws1, dataDir: data });
  assert.equal(first.project, null);
  assert.match(first.source, /2 repos/);
  rememberProject({ root: ws1, dataDir: data, project: 'shop' });
  assert.deepEqual(resolveProject({ root: workspace(), dataDir: data }), { project: 'shop', source: 'remembered remotes' });
  const beOnly = join(workspace(), 'be');
  assert.equal(resolveProject({ root: beOnly, dataDir: data }).project, 'shop');
});

test('components declared by remote are found whatever the sub-folder is called', () => {
  const root = tmp('nqt-ws-');
  mkdirSync(join(root, 'backend-123'));
  execFileSync('git', ['init', '-q'], { cwd: join(root, 'backend-123') });
  execFileSync('git', ['remote', 'add', 'origin', 'git@git.example.org:shop/backend.git'], { cwd: join(root, 'backend-123') });
  const comps = resolveComponents(root, [
    { name: 'api', remote: 'shop/backend', path: 'src', kind: 'be' },
    { name: 'web', remote: 'shop/frontend', kind: 'fe' },
    { name: 'docs', root: 'docs', kind: 'shared' },
  ]);
  assert.deepEqual(comps.map((c) => [c.name, c.root]), [['api', 'backend-123/src'], ['web', null], ['docs', 'docs']]);
});
