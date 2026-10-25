// nqt-leak-scan: ignore-file  (fictional fixture DB urls)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDataDir } from '../../plugin/scripts/lib/config.mjs';
import { readSchema } from '../../plugin/scripts/lib/schema.mjs';
import { analyzeImpact } from '../../plugin/scripts/lib/impact.mjs';

const fx = fileURLToPath(new URL('../fixtures/', import.meta.url));
const answers = (n) => JSON.parse(readFileSync(join(fx, 'answers', `${n}.json`), 'utf8'));

async function schemaOr(url, t) {
  try {
    return await readSchema(url, getDataDir());
  } catch (e) {
    t.skip(`fixture DB not reachable: ${e.message}`);
    return null;
  }
}

test('fixture A: students.full_name reaches every expected place, skips the decoy, flags dynamic SQL', async (t) => {
  const a = answers('school-a');
  const schema = await schemaOr('postgresql://school:school@localhost:55432/school_a', t);
  if (!schema) return;
  const q = a.questions[0];
  const impact = analyzeImpact({ start: q.start, schema, projectRoot: join(fx, 'school-a'), components: a.components });
  const byFile = new Map(impact.places.map((p) => [p.file, p]));
  for (const e of q.expectedPlaces) assert.ok(byFile.has(e.file), `missing ${e.file}`);
  for (const n of q.mustNotInclude) assert.ok(!byFile.has(n.file), `must not include ${n.file}`);
  assert.equal(byFile.get('api/src/reports/reports.service.ts').certainty, 'suspected');
  assert.equal(byFile.get('api/src/jobs/fee-reminder.job.ts').layer, 'job');
  const invoice = byFile.get('web/src/pages/FeeInvoicePage.tsx');
  assert.ok(invoice.via.length >= 1, 'invoice page is reached through the API chain');
  assert.equal(invoice.screen, '/fees/:studentId');
  assert.deepEqual(impact.unscanned, []);
  for (const r of ['GET /api/students', 'POST /api/students', 'GET /api/attendance', 'GET /api/classes/:id', 'GET /api/fees/:studentId/invoice']) {
    assert.ok(impact.routes.includes(r), `route not reached: ${r}`);
  }
  assert.notEqual(byFile.get('api/prisma/seed.mjs')?.certainty, 'suspected', 'seed data is not dynamic-SQL risk');
});

test('fixture B: students.phone with the adapter reaches worker, report and both screens', async (t) => {
  const b = answers('school-b');
  const schema = await schemaOr('mysql://school:school@127.0.0.1:53307/school_b', t);
  if (!schema) return;
  const q = b.questions[0];
  const impact = analyzeImpact({ start: q.start, schema, projectRoot: fx, components: b.components, adapter: b.adapter });
  const byFile = new Map(impact.places.map((p) => [p.file, p]));
  for (const e of q.expectedPlaces) assert.ok(byFile.has(e.file), `missing ${e.file}`);
  for (const n of q.mustNotInclude) assert.ok(!byFile.has(n.file), `must not include ${n.file}`);
  assert.equal(byFile.get('school-b-api/reports/contact-report.js').certainty, 'suspected');
  assert.equal(byFile.get('school-b-api/workers/sms.worker.js').layer, 'job');
});

test('a column that does not exist in the schema stops with a note instead of fuzzy matches', async (t) => {
  const a = answers('school-a');
  const schema = await schemaOr('postgresql://school:school@localhost:55432/school_a', t);
  if (!schema) return;
  const r = analyzeImpact({ start: { table: 'students', column: 'name' }, schema, projectRoot: join(fx, 'school-a'), components: a.components });
  assert.deepEqual(r.places, []);
  assert.ok(r.notes.some((n) => /column students\.name not found/.test(n)), r.notes.join('; '));
});

test('students.id does not match unrelated words like providers or getElementById', async (t) => {
  const a = answers('school-a');
  const schema = await schemaOr('postgresql://school:school@localhost:55432/school_a', t);
  if (!schema) return;
  const r = analyzeImpact({ start: { table: 'students', column: 'id' }, schema, projectRoot: join(fx, 'school-a'), components: a.components });
  const files = r.places.map((p) => p.file);
  assert.ok(!files.includes('api/src/app.module.ts'), 'providers is not id');
  assert.ok(!files.includes('web/src/main.tsx'), 'getElementById is not id');
});

test('a component missing on disk is reported as not scanned', async (t) => {
  const b = answers('school-b');
  const schema = await schemaOr('mysql://school:school@127.0.0.1:53307/school_b', t);
  if (!schema) return;
  const components = [b.components[0], { name: 'web', root: 'school-b-web-missing', kind: 'fe' }];
  const impact = analyzeImpact({ start: { table: 'students', column: 'phone' }, schema, projectRoot: fx, components, adapter: b.adapter });
  assert.deepEqual(impact.unscanned, ['web']);
});
