import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractRoutes, extractApiCalls, linkCalls, enclosingFunction, normalizePath } from '../../plugin/scripts/lib/routes.mjs';

const fx = fileURLToPath(new URL('../fixtures/', import.meta.url));
const adapterB = JSON.parse(readFileSync(join(fx, 'answers', 'school-b.json'), 'utf8')).adapter;
const key = (r) => `${r.method} ${r.path}`;

test('normalizePath unifies params, template slots, concatenation and query strings', () => {
  assert.equal(normalizePath('/students/:id'), '/students/:p');
  assert.equal(normalizePath('/api/classes/${id}'), '/api/classes/:p');
  assert.equal(normalizePath('/api/attendance?date=${date}'), '/api/attendance');
  assert.equal(normalizePath('/api//fees/'), '/api/fees');
});

test('NestJS routes include the global prefix and handler names', () => {
  const routes = extractRoutes([join(fx, 'school-a', 'api')]);
  const keys = routes.map(key);
  assert.ok(keys.includes('GET /api/students'), keys.join(', '));
  assert.ok(keys.includes('POST /api/students'));
  assert.ok(keys.includes('GET /api/fees/:studentId/invoice'));
  assert.equal(routes.find((r) => key(r) === 'POST /api/students').handler, 'create');
});

test('Express routes include the app.use mount prefix', () => {
  const keys = extractRoutes([join(fx, 'school-b-api')]).map(key);
  assert.ok(keys.includes('GET /api/v1/students/:id'), keys.join(', '));
  assert.ok(keys.includes('GET /api/v1/classes/:id/students'));
});

test('fixture A: page fetches link to API routes without any adapter', () => {
  const routes = extractRoutes([join(fx, 'school-a', 'api')]);
  const calls = extractApiCalls([join(fx, 'school-a', 'web')]);
  const links = linkCalls(routes, calls);
  const inv = links.find((l) => l.call.file.endsWith('FeeInvoicePage.tsx'));
  assert.ok(inv, 'invoice page should link');
  assert.equal(key(inv.route), 'GET /api/fees/:studentId/invoice');
});

test('fixture B: wrapper calls link only when the adapter supplies the base path', () => {
  const routes = extractRoutes([join(fx, 'school-b-api')]);
  const web = [join(fx, 'school-b-web')];
  const withAdapter = linkCalls(routes, extractApiCalls(web, adapterB));
  const detail = withAdapter.find((l) => l.call.file.endsWith('StudentDetail.tsx'));
  assert.ok(detail, 'StudentDetail should link with adapter');
  assert.equal(key(detail.route), 'GET /api/v1/students/:id');
  const without = linkCalls(routes, extractApiCalls(web));
  assert.equal(without.some((l) => l.call.file.endsWith('StudentDetail.tsx')), false);
});

test('enclosingFunction finds methods, functions and arrow constants', () => {
  const src = [
    'export class A {',
    '  async create(dto: X) {',
    '    if (x) {',
    '      return 1;',
    '    }',
    '  }',
    '}',
    'function helper() {',
    '  return 2;',
    '}',
    'const go = async (a) => {',
    '  return 3;',
    '};',
  ].join('\n');
  assert.equal(enclosingFunction(src, 4), 'create');
  assert.equal(enclosingFunction(src, 9), 'helper');
  assert.equal(enclosingFunction(src, 12), 'go');
});
