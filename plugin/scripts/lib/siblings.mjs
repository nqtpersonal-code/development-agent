import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { extractFunctions } from './functions.mjs';
import { nameVariants, splitWords } from './names.mjs';

const posix = (p) => p.split(sep).join('/');
const NOT_BUSINESS = /(^|\/)(prisma\/seed|seed|migrations?|fixtures?|__tests__|test|tests)(\/|\.|$)|\.(test|spec)\.|\.sql$/i;
const STOP = new Set(['const', 'let', 'var', 'return', 'this', 'await', 'async', 'new', 'if', 'else', 'function', 'true', 'false',
  'null', 'undefined', 'number', 'string', 'boolean', 'export', 'import', 'from', 'of', 'in', 'for', 'map', 'filter', 'length',
  'math', 'prisma', 'res', 'req', 'json', 'promise', 'void', 'any', 'type', 'interface', 'private', 'readonly', 'public']);
// Columns that scope or filter data: the conditions most often missing in a copy.
const FILTERISH = /(^|_)(deleted|removed|archived|active|enabled|disabled|status|state|tenant|company|branch|org|organization|owner|visible|hidden|published|locked)(_|$)|^(is|has)_/;

function words(text) {
  const out = new Set();
  for (const id of text.match(/[A-Za-z_$][\w$]*/g) ?? []) for (const w of splitWords(id)) if (w.length > 1 && !STOP.has(w)) out.add(w);
  return out;
}

function literals(text) {
  const out = new Set();
  for (const n of text.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) ?? []) if (n !== '0' && n !== '1') out.add(n);
  for (const s of text.match(/(['"])([^'"\n]{2,30})\1/g) ?? []) out.add(s.slice(1, -1));
  return out;
}

// Identifiers normalised to snake_case, keeping only multi-word ones (column-like).
function columnLike(text) {
  const out = new Set();
  for (const id of text.match(/[A-Za-z_][\w]*/g) ?? []) {
    const w = splitWords(id);
    if (w.length >= 2) out.add(w.join('_'));
  }
  return out;
}

const jaccard = (a, b) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter || 1);
};

function load(projectRoot, components, { businessOnly = true } = {}) {
  const comps = components.map((c) => ({ ...c, abs: join(projectRoot, c.root) })).filter((c) => existsSync(c.abs));
  return comps.flatMap((c) => extractFunctions([c.abs]).map((f) => ({
    ...f, kind: c.kind, file: posix(relative(projectRoot, join(f.root, f.file))),
  }))).filter((f) => !businessOnly || !NOT_BUSINESS.test(f.file));
}

const innermost = (fns, file, line) => fns
  .filter((f) => f.file === file && f.start <= line && line <= f.end)
  .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];

// Functions that do "the same thing" as the seed: similar vocabulary and shared
// business constants. Reports what they share and what differs.
export function findSiblings({ seed, projectRoot, components, minScore = 0.3, limit = 10 }) {
  const fns = load(projectRoot, components);
  const s = innermost(fns, seed.file, seed.line);
  if (!s) throw new Error(`no function at ${seed.file}:${seed.line}`);
  const sw = words(s.text);
  const sl = literals(s.text);
  const siblings = [];
  for (const f of fns) {
    if (f === s || (f.file === s.file && (f.start <= s.start && s.end <= f.end || s.start <= f.start && f.end <= s.end))) continue;
    const fw = words(f.text);
    const fl = literals(f.text);
    const shared = [...sl].filter((x) => fl.has(x));
    const score = 0.6 * jaccard(sw, fw) + 0.4 * (sl.size ? shared.length / sl.size : 0);
    if (score < minScore) continue;
    siblings.push({
      file: f.file, name: f.name, start: f.start, end: f.end, kind: f.kind,
      score: Math.round(score * 100) / 100,
      shared,
      onlyInSeed: [...sl].filter((x) => !fl.has(x)),
      onlyHere: [...fl].filter((x) => !sl.has(x)),
    });
  }
  siblings.sort((a, b) => b.score - a.score);
  return { seed: { file: s.file, name: s.name, start: s.start, end: s.end }, siblings: siblings.slice(0, limit) };
}

// Every business function touching a table, and the scoping/filter columns
// most of them use but some do not (e.g. a soft-delete filter missing in one copy).
export function tableVariants({ table, projectRoot, components, aliases = [] }) {
  const fns = load(projectRoot, components);
  const variants = [...nameVariants(table), ...aliases];
  const esc = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?<![A-Za-z0-9_$])(?:${variants.map(esc).join('|')})(?![a-z0-9_])`);
  const touching = fns.filter((f) => re.test(f.text));
  const be = touching.filter((f) => f.kind !== 'fe');
  const cols = be.map((f) => columnLike(f.text));
  const counts = new Map();
  for (const set of cols) for (const c of set) if (FILTERISH.test(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  const divergences = [];
  const threshold = Math.max(2, Math.ceil(be.length / 2));
  for (const [term, n] of counts) {
    if (n < threshold || n === be.length) continue;
    const users = be.filter((_, i) => cols[i].has(term));
    // A function that only delegates to one that applies the filter inherits it.
    const delegates = (f) => users.some((u) => new RegExp(`\\.${u.name}\\s*\\(`).test(f.text) && u.file !== f.file);
    const missing = be.filter((f, i) => !cols[i].has(term) && !delegates(f));
    if (!missing.length) continue;
    divergences.push({
      term,
      usedBy: users.map((f) => `${f.file}:${f.start} ${f.name}`),
      missingIn: missing.map((f) => `${f.file}:${f.start} ${f.name}`),
    });
  }
  return {
    table,
    functions: touching.map((f) => ({ file: f.file, name: f.name, start: f.start, end: f.end, kind: f.kind })),
    divergences,
  };
}

const SYNONYMS = [
  ['phone', 'phone_number', 'mobile', 'tel', 'telephone', 'cell', 'cellphone', 'sdt'],
  ['email', 'mail', 'email_address'],
  ['address', 'addr', 'street'],
  ['birth_date', 'birthday', 'dob', 'date_of_birth'],
  ['amount', 'total', 'price', 'cost', 'fee'],
];
const IGNORE = new Set(['id', 'created_at', 'updated_at', 'deleted_at', 'name']);

// DB columns that look like the same concept: same name with different types,
// or names from one synonym family spread over several tables.
export function columnVariants(schema) {
  const all = schema.tables.flatMap((t) => t.columns.map((c) => ({ table: t.name, column: c.name, type: c.type })));
  const groups = [];
  const byName = new Map();
  for (const c of all) {
    if (IGNORE.has(c.column)) continue;
    if (!byName.has(c.column)) byName.set(c.column, []);
    byName.get(c.column).push(c);
  }
  for (const [name, cols] of byName) {
    if (cols.length > 1 && new Set(cols.map((c) => c.type)).size > 1) groups.push({ reason: `same name "${name}", different types`, columns: cols });
  }
  for (const family of SYNONYMS) {
    const cols = all.filter((c) => family.includes(c.column) || family.some((f) => f.length > 3 && c.column.includes(f) && !IGNORE.has(c.column)));
    const tables = new Set(cols.map((c) => c.table));
    const names = new Set(cols.map((c) => c.column));
    if (tables.size > 1 && names.size > 1) groups.push({ reason: `same meaning (${family[0]}), different names`, columns: cols });
  }
  return groups;
}
