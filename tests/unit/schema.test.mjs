// nqt-leak-scan: ignore-file  (fictional fixture DB urls)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDataDir } from '../../plugin/scripts/lib/config.mjs';
import { readSchema, relatedTables, implicitRelations } from '../../plugin/scripts/lib/schema.mjs';

const A = 'postgresql://school:school@localhost:55432/school_a';
const B = 'mysql://school:school@127.0.0.1:53307/school_b';
const dataDir = getDataDir();

async function load(url, t) {
  try {
    return await readSchema(url, dataDir);
  } catch (e) {
    t.skip(`fixture DB not reachable (${e.message}); start the fixture's local DB`);
    return null;
  }
}

const has = (rels, from, to) =>
  rels.some((r) => `${r.from.table}.${r.from.column}` === from && `${r.to.table}.${r.to.column}` === to);

test('postgres fixture: real FKs and the implicit enrollment_ref relation', async (t) => {
  const s = await load(A, t);
  if (!s) return;
  assert.equal(s.engine, 'postgres');
  assert.ok(s.tables.some((x) => x.name === 'students' && x.columns.some((c) => c.name === 'full_name')));
  assert.ok(has(s.fks, 'enrollments.student_id', 'students.id'));
  const imp = s.implicit.find((r) => r.from.table === 'attendance' && r.from.column === 'enrollment_ref');
  assert.ok(imp, 'attendance.enrollment_ref should be inferred');
  assert.equal(imp.to.table, 'enrollments');
  assert.equal(imp.source, 'naming');
});

test('mysql fixture: no FKs, relations recovered by naming and multi-hop paths', async (t) => {
  const s = await load(B, t);
  if (!s) return;
  assert.equal(s.engine, 'mysql');
  assert.equal(s.fks.length, 0);
  assert.ok(has(s.implicit, 'enrollments.student_id', 'students.id'));
  assert.ok(has(s.implicit, 'sms_queue.student_id', 'students.id'));
  const att = relatedTables(s, 'students').find((r) => r.table === 'attendance');
  assert.ok(att, 'attendance should be reachable from students');
  assert.equal(att.path.length, 2);
});

test('readSchema refuses a non-local host before connecting', async () => {
  await assert.rejects(readSchema('postgresql://u:pw@db.staging.internal:5432/x', dataDir), /not local/);
});

test('implicitRelations never duplicates an existing FK', () => {
  const schema = {
    tables: [
      { name: 'students', columns: [{ name: 'id' }] },
      { name: 'fees', columns: [{ name: 'id' }, { name: 'student_id' }] },
    ],
    fks: [{ from: { table: 'fees', column: 'student_id' }, to: { table: 'students', column: 'id' }, source: 'fk' }],
  };
  assert.deepEqual(implicitRelations(schema), []);
});
