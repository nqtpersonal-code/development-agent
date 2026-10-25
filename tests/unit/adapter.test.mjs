// nqt-leak-scan: ignore-file  (fictional fixture DB urls)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp } from '../helpers/tmp.mjs';
import { getDataDir } from '../../plugin/scripts/lib/config.mjs';
import { readSchema } from '../../plugin/scripts/lib/schema.mjs';
import { analyzeImpact } from '../../plugin/scripts/lib/impact.mjs';
import { loadAdapter, saveAdapter, checkAssumptions, runAdapterTests, resolveDbUrl } from '../../plugin/scripts/lib/adapter.mjs';

const fx = fileURLToPath(new URL('../fixtures/', import.meta.url));
const b = JSON.parse(readFileSync(join(fx, 'answers', 'school-b.json'), 'utf8'));
const adapterB = { ...b.adapter, components: b.components };

function copyB() {
  const root = tmp('nqt-b-');
  const skip = (src) => !/node_modules/.test(src);
  cpSync(join(fx, 'school-b-api'), join(root, 'school-b-api'), { recursive: true, filter: skip });
  cpSync(join(fx, 'school-b-web'), join(root, 'school-b-web'), { recursive: true, filter: skip });
  return root;
}

async function schemaB(t) {
  try {
    return await readSchema('mysql://school:school@127.0.0.1:53307/school_b', getDataDir());
  } catch (e) {
    t.skip(`fixture DB not reachable: ${e.message}`);
    return null;
  }
}

test('adapter round-trips through the project folder', () => {
  const d = tmp();
  saveAdapter(d, 'school-b', adapterB);
  assert.deepEqual(loadAdapter(d, 'school-b'), adapterB);
  assert.equal(loadAdapter(d, 'missing'), null);
});

test('assumptions pass on the fixture and fail when the helper is renamed', () => {
  assert.ok(checkAssumptions(adapterB, fx).every((a) => a.ok));
  const root = copyB();
  renameSync(join(root, 'school-b-api', 'db', 'repo.js'), join(root, 'school-b-api', 'db', 'repository.js'));
  const res = checkAssumptions(adapterB, root);
  assert.equal(res.find((a) => a.id === 'repo-helper').ok, false);
});

test('impact refuses to run when an adapter assumption fails', async (t) => {
  const schema = await schemaB(t);
  if (!schema) return;
  const root = copyB();
  renameSync(join(root, 'school-b-api', 'db', 'repo.js'), join(root, 'school-b-api', 'db', 'repository.js'));
  const r = analyzeImpact({ start: { table: 'students', column: 'phone' }, schema, projectRoot: root, components: b.components, adapter: adapterB });
  assert.deepEqual(r.places, []);
  assert.ok(r.notes.includes('adapter-assumption-failed: repo-helper'));
});

test('adapter tests pass, and fail with the missing place when the wrapper pattern is removed', async (t) => {
  const schema = await schemaB(t);
  if (!schema) return;
  const d = tmp();
  saveAdapter(d, 'school-b', adapterB);
  mkdirSync(join(d, 'projects', 'school-b', 'tracer'), { recursive: true });
  writeFileSync(join(d, 'projects', 'school-b', 'tracer', 'tests.json'), JSON.stringify([
    {
      name: 'phone reaches worker and detail screen',
      start: { table: 'students', column: 'phone' },
      expect: [
        { file: 'school-b-api/workers/sms.worker.js' },
        { file: 'school-b-web/src/pages/StudentDetail.tsx', viaIncludes: 'GET /api/v1/students/:id' },
      ],
    },
  ]));
  const ok = runAdapterTests({ dataDir: d, project: 'school-b', projectRoot: fx, schema });
  assert.deepEqual(ok.map((x) => x.pass), [true]);
  saveAdapter(d, 'school-b', { ...adapterB, apiClientPatterns: [] });
  const bad = runAdapterTests({ dataDir: d, project: 'school-b', projectRoot: fx, schema });
  assert.equal(bad[0].pass, false);
  assert.match(bad[0].missing.join(' '), /StudentDetail\.tsx/);
});

test('resolveDbUrl reads a URL variable or builds one from host/port parts', () => {
  assert.equal(
    resolveDbUrl(join(fx, 'school-a'), { dbEnvFile: 'api/.env', dbEnvVar: 'DATABASE_URL' }),
    'postgresql://school:school@localhost:55432/school_a',
  );
  assert.equal(
    resolveDbUrl(fx, { dbEngine: 'mysql', dbEnvFile: 'school-b-api/.env' }),
    'mysql://school:school@127.0.0.1:53307/school_b',
  );
  assert.equal(resolveDbUrl(fx, { dbUrl: 'mysql://u@localhost/x' }), 'mysql://u@localhost/x');
});
