import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmp } from '../helpers/tmp.mjs';
import { extractFunctions } from '../../plugin/scripts/lib/functions.mjs';
import { findSiblings, tableVariants, columnVariants } from '../../plugin/scripts/lib/siblings.mjs';

const A = fileURLToPath(new URL('../fixtures/school-a/', import.meta.url));
const comps = [{ name: 'api', root: 'api', kind: 'be' }, { name: 'web', root: 'web', kind: 'fe' }];

test('extractFunctions finds methods, functions and arrow constants with line ranges', () => {
  const root = tmp();
  writeFileSync(join(root, 'a.ts'), [
    'export class S {',
    '  total(a: number) {',
    '    if (a) {',
    '      return 1;',
    '    }',
    '    return 2;',
    '  }',
    '}',
    'export function feeTotal(x) {',
    '  return x;',
    '}',
    'const go = async (a) => {',
    '  return a;',
    '};',
  ].join('\n'));
  const fns = extractFunctions([root]).map((f) => `${f.name}:${f.start}-${f.end}`);
  assert.deepEqual(fns, ['total:2-7', 'feeTotal:9-11', 'go:12-14']);
});

test('a business rule copied in two layers is found from either copy, with shared constants', () => {
  const r = findSiblings({ seed: { file: 'api/src/fees/fees.service.ts', line: 10 }, projectRoot: A, components: comps });
  assert.equal(r.seed.name, 'total');
  const twin = r.siblings.find((s) => s.file === 'web/src/pages/fees/total.ts');
  assert.ok(twin, `siblings: ${r.siblings.map((s) => s.file).join(', ')}`);
  assert.equal(twin.name, 'feeTotal');
  assert.ok(twin.shared.includes('20') && twin.shared.includes('0.9'), `shared: ${twin.shared}`);
});

test('functions touching a table are compared and the one missing the soft-delete filter stands out', () => {
  const r = tableVariants({ table: 'students', projectRoot: A, components: comps });
  const att = r.functions.find((f) => f.file === 'api/src/attendance/attendance.service.ts' && f.name === 'byDate');
  assert.ok(att, 'attendance byDate reads students');
  const gap = r.divergences.find((d) => d.term === 'deleted_at');
  assert.ok(gap, `divergences: ${JSON.stringify(r.divergences)}`);
  assert.ok(gap.missingIn.some((m) => m.startsWith('api/src/attendance/attendance.service.ts')));
  assert.ok(gap.usedBy.length >= 3);
  assert.ok(!gap.missingIn.some((m) => m.includes('students.controller.ts')), 'a controller that only delegates to a filtered service is not missing the filter');
  assert.ok(!r.functions.some((f) => /prisma\/seed/.test(f.file)), 'seed data is not business code');
});

test('columnVariants groups same-meaning columns with different names or types', () => {
  const schema = {
    tables: [
      { name: 'students', columns: [{ name: 'phone', type: 'varchar' }, { name: 'amount', type: 'integer' }] },
      { name: 'parents', columns: [{ name: 'phone_number', type: 'varchar' }] },
      { name: 'teachers', columns: [{ name: 'mobile', type: 'text' }] },
      { name: 'invoices', columns: [{ name: 'amount', type: 'varchar' }] },
      { name: 'classes', columns: [{ name: 'name', type: 'varchar' }] },
    ],
  };
  const groups = columnVariants(schema).map((g) => g.columns.map((c) => `${c.table}.${c.column}`).sort().join(' '));
  assert.ok(groups.includes('parents.phone_number students.phone teachers.mobile'), groups.join(' | '));
  assert.ok(groups.includes('invoices.amount students.amount'), groups.join(' | '));
  assert.ok(!groups.some((g) => g.includes('classes.name')));
});
