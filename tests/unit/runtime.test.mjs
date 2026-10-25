import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmp } from '../helpers/tmp.mjs';
import { runtimeRequire, NqtMissingRuntime, doctor } from '../../plugin/scripts/lib/runtime.mjs';

test('runtimeRequire on an empty runtime throws a hint naming doctor --install', () => {
  const d = tmp();
  mkdirSync(join(d, 'runtime'), { recursive: true });
  assert.throws(() => runtimeRequire(d, 'pg'), (e) => e instanceof NqtMissingRuntime && /doctor --install/.test(e.message));
});

test('doctor reports node as ok and lists missing runtime packages', () => {
  const d = tmp();
  mkdirSync(join(d, 'runtime'), { recursive: true });
  const r = doctor(d, { install: false, pluginsFile: join(d, 'none.json') });
  const byName = Object.fromEntries(r.checks.map((c) => [c.name, c]));
  assert.equal(byName.node.ok, true);
  assert.equal(byName['runtime:pg'].ok, false);
  assert.equal(byName.superpowers.ok, false);
  assert.equal(byName.superpowers.required, true);
});
