import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmp } from '../helpers/tmp.mjs';
import { addedLines, parseEslintJson, parseDotnetWarnings, onAddedLines } from '../../plugin/scripts/lib/lintchanged.mjs';

const cli = fileURLToPath(new URL('../../plugin/scripts/nqt.mjs', import.meta.url));
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.email=t@example.org', '-c', 'user.name=t', ...args], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};

test('addedLines lists the new line numbers per file', () => {
  const diff = ['+++ b/src/a.js', '@@ -2,0 +3,2 @@', '+x', '+y', '@@ -9 +11 @@', '-old', '+new', '+++ b/src/b.ts', '@@ -0,0 +1 @@', '+z'].join('\n');
  const added = addedLines(diff);
  assert.deepEqual([...added.get('src/a.js')], [3, 4, 11]);
  assert.deepEqual([...added.get('src/b.ts')], [1]);
});

test('parsers turn ESLint JSON and MSBuild lines into findings, and onAddedLines keeps only added lines', () => {
  const repo = join(tmp(), 'r');
  const json = JSON.stringify([{ filePath: join(repo, 'src', 'a.js'), messages: [
    { ruleId: 'no-unused-vars', severity: 2, line: 4, message: "'x' is assigned a value but never used." },
    { ruleId: null, severity: 1, line: 0, message: 'File ignored because of a matching ignore pattern.' },
    { ruleId: 'eqeqeq', severity: 1, line: 1, message: 'Expected ===' },
  ] }]);
  const es = parseEslintJson(json, repo);
  assert.deepEqual(es.map((f) => `${f.file}:${f.line} ${f.rule} ${f.severity}`), ['src/a.js:4 no-unused-vars error', 'src/a.js:1 eqeqeq warning']);
  assert.deepEqual(onAddedLines(es, new Map([['src/a.js', new Set([4, 5])]])).map((f) => f.line), [4]);
  const net = parseDotnetWarnings(`${join(repo, 'Svc.cs')}(12,5): warning CS8600: Converting null literal. [${join(repo, 'p.csproj')}]\nnot a diagnostic\n${join(repo, 'Svc.cs')}(12,5): warning CS8600: Converting null literal. [${join(repo, 'p.csproj')}]`, repo);
  assert.deepEqual(net.map((f) => `${f.file}:${f.line} ${f.rule} ${f.severity}`), ['Svc.cs:12 CS8600 warning']);
});

function repoWithChange({ config, eslintInstalled }) {
  const d = tmp();
  git(d, 'init', '-q', '-b', 'main');
  mkdirSync(join(d, 'src'), { recursive: true });
  writeFileSync(join(d, 'src', 'a.js'), 'one\ntwo\nthree\n');
  if (config) writeFileSync(join(d, 'eslint.config.js'), 'export default [];\n');
  if (eslintInstalled) {
    mkdirSync(join(d, 'node_modules', 'eslint', 'bin'), { recursive: true });
    // a stand-in ESLint: reports an old problem on line 1 and a new one on line 4 of every file it is given
    writeFileSync(join(d, 'node_modules', 'eslint', 'bin', 'eslint.js'), [
      "const path = require('node:path');",
      "const files = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== 'json');",
      "console.log(JSON.stringify(files.map((f) => ({ filePath: path.resolve(process.cwd(), f), messages: [",
      "  { ruleId: 'eqeqeq', severity: 1, line: 1, message: 'old problem' },",
      "  { ruleId: 'no-unused-vars', severity: 2, line: 4, message: 'new problem' } ] }))));",
    ].join('\n'));
  }
  git(d, 'add', '-A');
  git(d, 'commit', '-q', '-m', 'base');
  git(d, 'checkout', '-q', '-b', 'feature');
  writeFileSync(join(d, 'src', 'a.js'), 'one\ntwo\nthree\nfour\nfive\n');
  git(d, 'commit', '-q', '-am', 'change');
  return d;
}

const run = (d) => spawnSync(process.execPath, [cli, 'lint-changed', '--root', d, '--base', 'main'], { encoding: 'utf8' });

test('lint-changed reports only what the project linter says about lines the change added', () => {
  const r = run(repoWithChange({ config: true, eslintInstalled: true }));
  assert.equal(r.status, 1);
  assert.match(r.stdout, /1 finding\(s\) on lines this change added/);
  assert.match(r.stdout, /src\/a\.js:4 \[eslint no-unused-vars, error\] new problem/);
  assert.doesNotMatch(r.stdout, /old problem/);
});

test('lint-changed says so when the project has no linter, or it is not installed, and never installs anything', () => {
  const none = run(repoWithChange({ config: false, eslintInstalled: false }));
  assert.equal(none.status, 0);
  assert.match(none.stdout, /note: eslint not run — no ESLint configuration/);
  const missing = run(repoWithChange({ config: true, eslintInstalled: false }));
  assert.equal(missing.status, 0);
  assert.match(missing.stdout, /configured but not installed/);
});
