import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { blastRadius } from '../../plugin/scripts/lib/radius.mjs';

const A = fileURLToPath(new URL('../fixtures/school-a/', import.meta.url));
const comps = [{ name: 'api', root: 'api', kind: 'be' }, { name: 'web', root: 'web', kind: 'fe' }];

test('the fee rule reaches its caller in the same file, the invoice API and the invoice screen', () => {
  const r = blastRadius({ file: 'api/src/fees/fees.service.ts', fn: 'total', projectRoot: A, components: comps });
  assert.ok(r.callers.some((c) => c.file === 'api/src/fees/fees.service.ts' && c.enclosing === 'invoice'), JSON.stringify(r.callers));
  assert.ok(r.routes.includes('GET /api/fees/:studentId/invoice'), r.routes.join(', '));
  assert.ok(r.screens.includes('/fees/:studentId'), r.screens.join(', '));
  const ctrl = r.callers.filter((c) => c.file === 'api/src/fees/fees.controller.ts');
  assert.equal(ctrl.length, 1, 'the controller method declaration is not a call site');
});

test('the student list query reaches only the students API and page', () => {
  const r = blastRadius({ file: 'api/src/students/students.service.ts', fn: 'list', projectRoot: A, components: comps });
  assert.deepEqual(r.routes, ['GET /api/students']);
  assert.ok(r.screens.includes('/students'));
  assert.ok(!r.screens.includes('/attendance'));
});
