import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tmp } from '../helpers/tmp.mjs';
import { getDataDir } from '../../plugin/scripts/lib/config.mjs';
import { uiCheck } from '../../plugin/scripts/lib/uicheck.mjs';

const ui = fileURLToPath(new URL('../fixtures/ui/', import.meta.url));
const url = (f) => pathToFileURL(join(ui, f)).href;

test('a broken page shows all four measurable defects on a phone', async () => {
  const out = tmp();
  const r = await uiCheck({ url: url('bad.html'), outDir: out, dataDir: getDataDir() });
  const mobile = new Set(r.issues.filter((i) => i.viewport === 'mobile').map((i) => i.type));
  for (const t of ['horizontal-overflow', 'text-clipped', 'small-tap-target', 'covered-input']) assert.ok(mobile.has(t), `missing ${t}`);
  for (const v of ['mobile', 'tablet', 'desktop']) assert.ok(existsSync(join(out, `${v}.png`)), `${v}.png`);
  assert.ok(existsSync(join(out, 'report.json')));
});

test('a responsive page shows no defects', async () => {
  const r = await uiCheck({ url: url('good.html'), outDir: tmp(), dataDir: getDataDir() });
  assert.deepEqual(r.issues, []);
});
