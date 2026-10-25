import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { detectComponents, adapterNeeded } from '../../plugin/scripts/lib/health.mjs';
import { ruleSections } from '../../plugin/scripts/lib/docs.mjs';

const fx = fileURLToPath(new URL('../fixtures/', import.meta.url));
const plugin = fileURLToPath(new URL('../../plugin/', import.meta.url));

test('components are detected from manifests: front end and back end', () => {
  const a = detectComponents(join(fx, 'school-a')).map((c) => `${c.name}:${c.root}:${c.kind}`);
  assert.deepEqual(a.sort(), ['api:api:be', 'web:web:fe']);
  const c = detectComponents(join(fx, 'clinic')).map((x) => `${x.root}:${x.kind}`);
  assert.deepEqual(c.sort(), ['src/Clinic.Api:be', 'src/clinic-web:fe']);
});

test('a conventional project needs no adapter', () => {
  const r = adapterNeeded({ projectRoot: join(fx, 'school-a'), components: detectComponents(join(fx, 'school-a')) });
  assert.equal(r.needed, false, r.reasons.join('; '));
  const c = adapterNeeded({ projectRoot: join(fx, 'clinic'), components: detectComponents(join(fx, 'clinic')) });
  assert.equal(c.needed, false, c.reasons.join('; '));
});

test('front-end calls that only match routes by suffix mean a wrapper with a base path: adapter needed', () => {
  const comps = [{ name: 'api', root: 'school-b-api', kind: 'be' }, { name: 'web', root: 'school-b-web', kind: 'fe' }];
  const r = adapterNeeded({ projectRoot: fx, components: comps });
  assert.equal(r.needed, true);
  assert.match(r.reasons.join(' '), /base path/);
});

test('ruleSections returns only the requested headings', () => {
  const text = ruleSections(join(plugin, 'shared', 'rules.md'), ['Never guess', 'Local DB guard']);
  assert.match(text, /^## Never guess/m);
  assert.match(text, /^## Local DB guard/m);
  assert.doesNotMatch(text, /^## Confidentiality/m);
  assert.throws(() => ruleSections(join(plugin, 'shared', 'rules.md'), ['No such rule']), /No such rule/);
});
