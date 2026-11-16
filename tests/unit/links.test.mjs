import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmp } from '../helpers/tmp.mjs';
import { extractRefs, checkLinks } from '../../plugin/scripts/lib/links.mjs';
import { checkWork } from '../../plugin/scripts/lib/workcheck.mjs';

function project() {
  const root = tmp();
  mkdirSync(join(root, 'api/src/students'), { recursive: true });
  mkdirSync(join(root, 'web/src/pages'), { recursive: true });
  writeFileSync(join(root, 'api/src/students/students.service.ts'), Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\n') + '\n');
  writeFileSync(join(root, 'web/src/pages/StudentsPage.tsx'), 'a\nb\nc\n');
  return root;
}

test('extractRefs reads markdown links with anchors, labels with lines, and bare file:line mentions', () => {
  const refs = extractRefs([
    'Duplicate names are refused ([students.service.ts:26-27](api/src/students/students.service.ts#L26-L27)).',
    'Technical: `StudentsPage.tsx:2` shows the name; server at localhost:3101 and [home](https://example.org/a.ts:5).',
    'A picture: [shot](C:/work/qa/shots/a.png)',
  ].join('\n'));
  assert.deepEqual(refs.map((r) => `${r.line}:${r.path}:${r.start}-${r.end}:${r.linked}`), [
    '1:api/src/students/students.service.ts:26-27:true',
    '2:StudentsPage.tsx:2-2:false',
  ]);
});

test('checkLinks accepts real lines and reports invented files, lines past the end, and label/link disagreement', () => {
  const root = project();
  const work = tmp();
  writeFileSync(join(work, 'impact.md'), [
    '[students.service.ts:26-27](api/src/students/students.service.ts#L26-L27)',
    '[students.service.ts:39-45](api/src/students/students.service.ts#L39-L45)',
    '[teachers.service.ts:5](api/src/teachers/teachers.service.ts#L5)',
    '[students.service.ts:10](api/src/students/students.service.ts#L12)',
    '[AttendancePage.tsx:3](web/src/pages/StudentsPage.tsx#L3)',
    'bare: `StudentsPage.tsx:3` and `StudentsPage.tsx:9`',
  ].join('\n'));
  const problems = checkLinks({ work, root, files: ['impact.md'] });
  assert.deepEqual(problems, [
    'impact.md:2 [students.service.ts:39-45] — the file has only 40 lines',
    'impact.md:3 [teachers.service.ts:5] — no such file in the project',
    'impact.md:4 [students.service.ts:12] — the label says line 10 but the link points at line 12',
    'impact.md:5 [StudentsPage.tsx:3] — the label names AttendancePage.tsx but the link points at StudentsPage.tsx',
    'impact.md:6 [StudentsPage.tsx:9] — the file has only 3 lines',
  ]);
});

test('check-work with a project folder also checks the evidence links of that step', () => {
  const root = project();
  const impact = ['## Change points', '| a [students.service.ts:30](api/src/students/students.service.ts#L30) | must patch |', '## What else this could break', 'none', '## Already in the system', 'none', '## Checked and rejected', 'none', '## Not scanned', 'none', '[gone.ts:4](api/src/gone.ts#L4)'].join('\n');
  const d = tmp();
  writeFileSync(join(d, 'ba.md'), 'Screen design needed: no\nTicket kind: bug');
  mkdirSync(join(d, 'trace'), { recursive: true });
  writeFileSync(join(d, 'trace', 'impact.md'), impact);
  assert.deepEqual(checkWork(d, 'analysis').problems, []);
  assert.deepEqual(checkWork(d, 'analysis', { root }).problems, ['trace/impact.md:11 [gone.ts:4] — no such file in the project']);
});
