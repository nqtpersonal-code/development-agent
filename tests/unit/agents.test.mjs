import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from '../../plugin/scripts/lib/frontmatter.mjs';

const plugin = fileURLToPath(new URL('../../plugin/', import.meta.url));
const AGENTS = ['setup', 'ba', 'code-tracer', 'screen-designer', 'system-explainer', 'architect', 'plan-checker', 'reviewer', 'qa', 'ui-checker'];
const SKILLS = ['work-ticket', 'ask-system', 'retro', 'add-pattern'];
const RULE_HEADINGS = [
  'Natural-language interface', 'Source labels', 'Never guess', 'Code and DB are truth', 'Surgical changes',
  'Repo hygiene', 'Local DB guard', 'Language and nicknames', 'Confidentiality', 'Pattern library priority',
  'When the owner doubts a conclusion', 'Token discipline',
];
const read = (p) => readFileSync(join(plugin, p), 'utf8');
const present = (dir, names, ext) => names.filter((n) => existsSync(join(plugin, dir, ext ? `${n}${ext}` : n)));

test('rules.md has every heading agents cite', () => {
  const rules = read('shared/rules.md');
  for (const h of RULE_HEADINGS) assert.ok(rules.includes(`## ${h}`), h);
});

test('agent files exist with valid frontmatter, cite shared rules and have no placeholders', () => {
  const have = present('agents', AGENTS, '.md');
  assert.ok(have.length >= 5, `expected agents, found ${have.join(', ') || 'none'}`);
  for (const a of have) {
    const text = read(`agents/${a}.md`);
    const fm = parseFrontmatter(text);
    assert.equal(fm.name, a, `${a}: name`);
    assert.ok(typeof fm.description === 'string' && fm.description.length > 40, `${a}: description`);
    assert.ok(typeof fm.tools === 'string' && fm.tools.length > 0, `${a}: tools`);
    assert.match(text, /shared\/rules\.md/, `${a}: must cite shared/rules.md`);
    assert.doesNotMatch(text, /\bTODO\b|\bTBD\b/, `${a}: placeholder`);
    for (const m of text.matchAll(/rules\.md → ([^"\n)]+?)(?:["\n)]|$)/g)) {
      assert.ok(RULE_HEADINGS.includes(m[1].trim()), `${a}: cites unknown rule heading "${m[1].trim()}"`);
    }
  }
});

test('every agent named in the plan exists', () => {
  assert.deepEqual(present('agents', AGENTS, '.md'), AGENTS);
});

test('skills exist with frontmatter and their referenced files exist', () => {
  for (const s of present('skills', SKILLS)) {
    const text = read(`skills/${s}/SKILL.md`);
    const fm = parseFrontmatter(text);
    assert.equal(fm.name, s);
    assert.ok(typeof fm.description === 'string' && fm.description.length > 40, `${s}: description`);
    for (const m of text.matchAll(/\]\((references\/[^)#]+)\)/g)) {
      assert.ok(existsSync(join(plugin, 'skills', s, m[1])), `${s}: missing ${m[1]}`);
    }
  }
  assert.deepEqual(present('skills', SKILLS), SKILLS);
});

test('starter pattern packs have index.md with required frontmatter', () => {
  for (const pack of readdirSync(join(plugin, 'starter-patterns'))) {
    const fm = parseFrontmatter(read(`starter-patterns/${pack}/index.md`));
    for (const k of ['title', 'teaches', 'languages', 'frameworks', 'layers', 'situations']) assert.ok(fm[k], `${pack}: ${k}`);
    assert.ok(readdirSync(join(plugin, 'starter-patterns', pack)).length >= 2, `${pack}: needs content beside index.md`);
  }
});
