import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp } from '../helpers/tmp.mjs';
import { callersFromGraph } from '../../plugin/scripts/lib/graphify.mjs';
import { analyzeImpact } from '../../plugin/scripts/lib/impact.mjs';

const fx = fileURLToPath(new URL('../fixtures/', import.meta.url));

test('callersFromGraph reads node-link graphs and returns calling symbols with files', () => {
  const d = tmp();
  writeFileSync(join(d, 'graph.json'), JSON.stringify({
    nodes: [
      { id: 'a', label: 'FeesService.invoice', source_file: 'api/src/fees/fees.service.ts' },
      { id: 'b', label: 'FeesController.invoice', source_file: 'api/src/fees/fees.controller.ts' },
      { id: 'c', label: 'Other.x', source_file: 'api/src/other.ts' },
    ],
    links: [
      { source: 'b', target: 'a', relation: 'calls' },
      { source: 'c', target: 'b', relation: 'imports' },
    ],
  }));
  assert.deepEqual(callersFromGraph(d, 'FeesService.invoice'), [{ file: 'api/src/fees/fees.controller.ts', symbol: 'FeesController.invoice' }]);
  assert.deepEqual(callersFromGraph(d, 'missing'), []);
});

test('without a graph, impact says caller tracing used name search', () => {
  const r = analyzeImpact({
    start: { table: 'students', column: 'full_name' },
    schema: null,
    projectRoot: join(fx, 'school-a'),
    components: [{ name: 'api', root: 'api', kind: 'be' }, { name: 'web', root: 'web', kind: 'fe' }],
  });
  assert.ok(r.notes.includes('caller-tracing: name-search (less precise)'));
});
