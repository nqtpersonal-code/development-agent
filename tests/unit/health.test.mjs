import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp } from '../helpers/tmp.mjs';
import { snapshot, compareSnapshots } from '../../plugin/scripts/lib/health.mjs';

const A = fileURLToPath(new URL('../fixtures/school-a/', import.meta.url));
const comps = [{ name: 'api', root: 'api', kind: 'be' }, { name: 'web', root: 'web', kind: 'fe' }];

function copyA() {
  const root = join(tmp('nqt-health-'), 'school');
  cpSync(A, root, { recursive: true, filter: (s) => !/node_modules|[\\/]dist/.test(s) });
  return root;
}

test('a snapshot records components, data libraries and how well calls link to routes', () => {
  const s = snapshot({ projectRoot: A, components: comps });
  assert.ok(s.dataLibs.includes('@prisma/client'));
  assert.ok(s.routes >= 7);
  assert.ok(s.linkRate >= 0.8, `linkRate ${s.linkRate}`);
  assert.deepEqual(s.unknownPackages, []);
});

test('an unchanged project shows no drift', () => {
  const base = snapshot({ projectRoot: A, components: comps });
  assert.deepEqual(compareSnapshots(base, snapshot({ projectRoot: A, components: comps })).drift, []);
});

test('a new API helper used in several screens, a new package and a new DB library are reported as drift', () => {
  const root = copyA();
  const base = snapshot({ projectRoot: root, components: comps });
  writeFileSync(join(root, 'web', 'src', 'lib', 'http.ts'), "export const http = { get: (p: string) => fetch('/api/v2' + p) };\n");
  for (const n of [1, 2, 3]) {
    writeFileSync(join(root, 'web', 'src', 'pages', `Report${n}.tsx`), `import { http } from '../lib/http';\nexport default function Report${n}() { http.get('/reports/${n}'); return null; }\n`);
  }
  mkdirSync(join(root, 'worker'));
  writeFileSync(join(root, 'worker', 'package.json'), '{"name":"worker","dependencies":{"bullmq":"^5.0.0"}}');
  const pkg = JSON.parse(readFileSync(join(root, 'api', 'package.json'), 'utf8'));
  pkg.dependencies.typeorm = '^0.3.20';
  writeFileSync(join(root, 'api', 'package.json'), JSON.stringify(pkg));
  const drift = compareSnapshots(base, snapshot({ projectRoot: root, components: comps })).drift.map((d) => d.kind);
  assert.ok(drift.includes('new-call-helper'), drift.join(', '));
  assert.ok(drift.includes('new-package'), drift.join(', '));
  assert.ok(drift.includes('new-data-library'), drift.join(', '));
});
