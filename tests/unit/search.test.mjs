import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmp } from '../helpers/tmp.mjs';
import { nameVariants } from '../../plugin/scripts/lib/names.mjs';
import { searchCode } from '../../plugin/scripts/lib/search.mjs';

const fixtures = fileURLToPath(new URL('../fixtures/', import.meta.url));
const answersA = JSON.parse(readFileSync(join(fixtures, 'answers', 'school-a.json'), 'utf8'));

test('nameVariants for a snake_case column', () => {
  assert.deepEqual(nameVariants('full_name'), ['full_name', 'fullName', 'FullName', 'full-name', 'FULL_NAME']);
});

test('nameVariants for a plural table name include singular forms', () => {
  const v = nameVariants('students');
  for (const x of ['students', 'Students', 'student', 'Student', 'STUDENTS']) assert.ok(v.includes(x), x);
  assert.ok(nameVariants('classes').includes('class'));
  assert.ok(nameVariants('categories').includes('category'));
});

test('column search with table context finds direct users and skips the teacher decoy', () => {
  const root = join(fixtures, 'school-a');
  const { hits } = searchCode({
    roots: [root],
    terms: nameVariants('full_name'),
    contextTerms: nameVariants('students'),
  });
  const files = new Set(hits.map((h) => h.file.replace(/\\/g, '/')));
  const expected = answersA.questions[0].expectedPlaces
    .map((p) => p.file)
    .filter((f) => f !== 'web/src/pages/FeeInvoicePage.tsx'); // reached via the API, not by name
  for (const f of expected) assert.ok(files.has(f), `missing ${f}`);
  assert.ok(!files.has('api/src/classes/teacher.ts'), 'teacher decoy must be filtered out');
});

test('paths with spaces and Vietnamese file names are searched', () => {
  const root = join(tmp(), 'thư mục a b');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'mẫu.ts'), 'const student = row.full_name;\n');
  const { hits } = searchCode({ roots: [root], terms: ['full_name'] });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].file, 'mẫu.ts');
  assert.equal(hits[0].line, 1);
});

test('terms match whole identifiers only, not pieces of longer words', () => {
  const root = tmp();
  writeFileSync(join(root, 'a.ts'), 'providers: [];\ndocument.getElementById("x");\nconst id = row.id;\nwhere(s.full_name)\n<Route path="/classes/:id" />\n');
  const { hits } = searchCode({ roots: [root], terms: nameVariants('id') });
  assert.deepEqual(hits.map((h) => h.line), [3]);
});

test('fileFilter limits the search to matching files', () => {
  const root = tmp();
  writeFileSync(join(root, 'a.ts'), "q('SELECT ' + col + ' FROM students') // phone\n");
  writeFileSync(join(root, 'b.ts'), 'const phone = 1;\n');
  const { hits } = searchCode({ roots: [root], terms: ['phone'], fileFilter: /FROM\s*['"`]?\s*\+|' \+ col/ });
  assert.deepEqual(hits.map((h) => h.file), ['a.ts']);
});

test('maxHits truncates and reports it', () => {
  const root = tmp();
  writeFileSync(join(root, 'a.ts'), Array.from({ length: 50 }, () => 'full_name').join('\n'));
  const r = searchCode({ roots: [root], terms: ['full_name'], maxHits: 10 });
  assert.equal(r.hits.length, 10);
  assert.equal(r.truncated, true);
});
