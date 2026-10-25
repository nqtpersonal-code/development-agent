// nqt-leak-scan: ignore-file
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmp } from '../helpers/tmp.mjs';
import { scanLeaks, projectNamesFrom } from '../../plugin/scripts/lib/leaks.mjs';

const kinds = (findings) => findings.map((f) => f.kind).sort();
const one = (content, path = 'plugin/agents/x.md', projectNames = []) =>
  scanLeaks({ files: [{ path, content }], projectNames });

test('project names are caught across casing, separators and diacritics', () => {
  for (const text of ['Truong-ABC', 'truong abc', 'TRUONG_ABC', 'Trường ABC']) {
    const f = one(`see ${text} here`, 'plugin/agents/x.md', ['truong-abc']);
    assert.deepEqual(kinds(f), ['project-name'], text);
  }
});

test('project names next to punctuation, in paths and squashed are caught', () => {
  const probes = ['"truong-abc"', 'projects/truong-abc/project.md', '(Trường ABC)', '`truong-abc`', 'truong-abc,', 'truong-abc:', 'TruongABC', 'truongabc.vn'];
  for (const text of probes) {
    const f = one(`x ${text} y`, 'plugin/agents/x.md', ['truong-abc']);
    assert.deepEqual(kinds(f), ['project-name'], text);
  }
});

test('short single-word names are not matched inside other words', () => {
  assert.deepEqual(one('a subclass here', 'plugin/agents/x.md', ['class']), []);
});

test('ticket ids are caught outside fixtures and relaxed inside fixtures', () => {
  assert.deepEqual(kinds(one('fixes JIRA-123')), ['ticket-id']);
  assert.deepEqual(kinds(one('see #4521')), ['ticket-id']);
  assert.deepEqual(one('fixes JIRA-123', 'tests/fixtures/tickets/a.md'), []);
});

test('secrets and credentialed DB urls are caught everywhere', () => {
  assert.deepEqual(kinds(one('DATABASE_URL=postgresql://u:pw@db:5432/x')), ['secret']);
  assert.deepEqual(kinds(one('api_key: abcdef123456789')), ['secret']);
  assert.deepEqual(kinds(one('-----BEGIN PRIVATE KEY-----')), ['secret']);
  assert.deepEqual(kinds(one('password: hunter2hunter2', 'tests/fixtures/a/.env')), ['secret']);
});

test('fixture DB urls with the fictional school password are allowed', () => {
  assert.deepEqual(one('postgresql://school:school@localhost:55432/school_a', 'tests/fixtures/school-a/.env'), []);
});

test('internal urls and emails are caught, allowlisted ones are not', () => {
  assert.deepEqual(kinds(one('see https://git.company.internal/x')), ['url']);
  assert.deepEqual(kinds(one('mail boss@company.vn')), ['email']);
  assert.deepEqual(one('see https://github.com/anthropics/claude-code and http://localhost:3000 and noreply@anthropic.com'), []);
});

test('emails at reserved example domains are allowed', () => {
  assert.deepEqual(one('git config user.email t@example.com and a@test.example.org'), []);
});

test('clean fictional text produces no findings and lines are reported', () => {
  assert.deepEqual(one('Học sinh HS trong lớp L1 ngày 22/09'), []);
  const [f] = one('line one\nfixes JIRA-9');
  assert.equal(f.line, 2);
});

test('an ignore-file directive skips pattern rules but never project names', () => {
  const content = '// nqt-leak-scan: ignore-file\nfixes JIRA-123 for Truong ABC';
  assert.deepEqual(kinds(one(content, 'tests/unit/x.test.mjs', ['truong-abc'])), ['project-name']);
});

test('projectNamesFrom reads directory names and aliases from project.md', () => {
  const d = tmp();
  mkdirSync(join(d, 'projects', 'acme-erp'), { recursive: true });
  writeFileSync(join(d, 'projects', 'acme-erp', 'project.md'), '---\nname: Acme ERP\naliases: [acmex, ae-portal]\n---\n');
  assert.deepEqual(projectNamesFrom(d).sort(), ['Acme ERP', 'acme-erp', 'acmex', 'ae-portal'].sort());
});
