// nqt-leak-scan: ignore-file  (fictional remotes)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmp } from '../helpers/tmp.mjs';
import { projectIdFromRepo, resolveProject, rememberProject } from '../../plugin/scripts/lib/project-id.mjs';

const gitRepo = (remote) => {
  const root = tmp('nqt-proj-');
  execFileSync('git', ['init', '-q'], { cwd: root });
  if (remote) execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: root });
  return root;
};

test('projectIdFromRepo turns a repo path into a safe folder name', () => {
  assert.equal(projectIdFromRepo('shop/backend'), 'shop-backend');
  assert.equal(projectIdFromRepo('Team/Sub Group/App.Web'), 'team-sub-group-app-web');
});

test('two ticket folders cloned from the same repo resolve to the same project', () => {
  const data = tmp();
  const a = gitRepo('git@git.example.org:shop/backend.git');
  const b = gitRepo('https://git.example.org/shop/backend.git');
  assert.deepEqual(resolveProject({ root: a, dataDir: data }), { project: 'shop-backend', source: 'git remote' });
  assert.equal(resolveProject({ root: b, dataDir: data }).project, 'shop-backend');
});

test('an explicit name wins, and a chosen name is remembered for the remote', () => {
  const data = tmp();
  const a = gitRepo('git@git.example.org:shop/backend.git');
  assert.equal(resolveProject({ root: a, dataDir: data, explicit: 'shop' }).project, 'shop');
  rememberProject({ root: a, dataDir: data, project: 'shop' });
  const b = gitRepo('https://git.example.org/shop/backend.git');
  assert.deepEqual(resolveProject({ root: b, dataDir: data }), { project: 'shop', source: 'remembered remote' });
});

test('a folder without a remote is unknown until remembered', () => {
  const data = tmp();
  const plain = gitRepo(null);
  assert.equal(resolveProject({ root: plain, dataDir: data }).project, null);
  rememberProject({ root: plain, dataDir: data, project: 'side-tool' });
  assert.deepEqual(resolveProject({ root: plain, dataDir: data }), { project: 'side-tool', source: 'remembered folder' });
  const notGit = join(tmp(), 'x');
  mkdirSync(notGit);
  assert.equal(resolveProject({ root: notGit, dataDir: data }).project, null);
});
