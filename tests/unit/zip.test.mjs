// nqt-leak-scan: ignore-file
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { tmp } from '../helpers/tmp.mjs';
import { exportZip, listZip } from '../../plugin/scripts/lib/zip.mjs';

function fakeRepo(dirName = 'repo') {
  const root = join(tmp('nqt zip '), dirName);
  mkdirSync(join(root, '.claude-plugin'), { recursive: true });
  mkdirSync(join(root, 'plugin', '.claude-plugin'), { recursive: true });
  mkdirSync(join(root, 'plugin', 'skills', 'x'), { recursive: true });
  mkdirSync(join(root, 'tests', 'fixtures'), { recursive: true });
  writeFileSync(join(root, '.claude-plugin', 'marketplace.json'), '{}');
  writeFileSync(join(root, 'plugin', '.claude-plugin', 'plugin.json'), '{"name":"nqt"}');
  writeFileSync(join(root, 'plugin', 'skills', 'x', 'mẫu.md'), 'Học sinh lớp L1');
  writeFileSync(join(root, 'tests', 'fixtures', 'a.md'), 'fixture');
  writeFileSync(join(root, 'README.md'), '# readme');
  return root;
}

test('the zip holds the plugin, marketplace and readme but no tests', () => {
  const root = fakeRepo();
  const out = exportZip({ repoRoot: root, outDir: join(root, 'dist'), version: '0.1.0', projectNames: [] });
  assert.equal(basename(out), 'nqt-plugin-0.1.0.zip');
  const entries = listZip(out);
  assert.ok(entries.includes('plugin/.claude-plugin/plugin.json'), entries.join('\n'));
  assert.ok(entries.includes('.claude-plugin/marketplace.json'));
  assert.ok(entries.includes('README.md'));
  assert.ok(entries.includes('plugin/skills/x/mẫu.md'), 'non-ASCII file name survives');
  assert.ok(!entries.some((e) => e.startsWith('tests/')));
});

test('a planted secret aborts the export and names the file', () => {
  const root = fakeRepo();
  writeFileSync(join(root, 'plugin', 'skills', 'x', 'bad.md'), 'DATABASE_URL=postgresql://admin:Sup3rSecret@db:5432/x');
  assert.throws(
    () => exportZip({ repoRoot: root, outDir: join(root, 'dist'), version: '0.1.0', projectNames: [] }),
    /bad\.md/,
  );
  assert.equal(existsSync(join(root, 'dist', 'nqt-plugin-0.1.0.zip')), false);
});
