import { dirname, join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { walkFiles, readText, rel } from './files.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/;
const HTTP = ['get', 'post', 'put', 'patch', 'delete', 'all'];

export function normalizePath(p) {
  let s = String(p).split('?')[0];
  s = s.replace(/\$\{[^}]*\}/g, ':p').replace(/:[A-Za-z_]\w*/g, ':p').replace(/\{[^}/]+\}/g, ':p');
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s || '/';
}

const join2 = (...parts) => '/' + parts.map((x) => String(x ?? '').replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function codeFiles(roots) {
  const out = [];
  for (const root of roots) for (const abs of walkFiles(root)) if (CODE.test(abs)) out.push({ root, abs, text: readText(abs) ?? '' });
  return out;
}

function globalPrefix(files) {
  for (const f of files) {
    const m = /setGlobalPrefix\(\s*['"`]([^'"`]+)['"`]/.exec(f.text);
    if (m) return m[1];
  }
  return '';
}

// Express mounts: app.use('/api/v1', require('./routes/x')) or app.use('/p', varName) with an import/require of varName.
function expressMounts(files) {
  const mounts = new Map();
  for (const f of files) {
    const direct = /\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*require\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    for (const m of f.text.matchAll(direct)) addMount(mounts, f.abs, m[2], m[1]);
    const byVar = /\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g;
    for (const m of f.text.matchAll(byVar)) {
      const imp = new RegExp(`(?:import\\s+${m[2]}\\s+from|(?:const|let|var)\\s+${m[2]}\\s*=\\s*require\\()\\s*['"\`]([^'"\`]+)['"\`]`).exec(f.text);
      if (imp) addMount(mounts, f.abs, imp[1], m[1]);
    }
  }
  return mounts;
}

function addMount(mounts, fromFile, spec, prefix) {
  if (!spec.startsWith('.')) return;
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.js`, `${base}.ts`, `${base}.mjs`, join(base, 'index.js'), join(base, 'index.ts')]) {
    if (existsSync(cand)) {
      mounts.set(resolve(cand), prefix);
      return;
    }
  }
}

function nextHandlerName(text, fromIndex) {
  const after = text.slice(fromIndex).split('\n').slice(1, 6);
  for (const l of after) {
    const m = /^\s*(?:public\s+|private\s+|protected\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(l);
    if (m && !l.trim().startsWith('@')) return m[1];
  }
  return undefined;
}

export function extractRoutes(roots, adapter = {}) {
  const files = codeFiles(roots);
  const prefix = globalPrefix(files);
  const mounts = expressMounts(files);
  const routes = [];
  for (const f of files) {
    const file = rel(f.root, f.abs);
    const ctrl = /@Controller\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/.exec(f.text);
    if (ctrl) {
      const dec = /@(Get|Post|Put|Patch|Delete|All)\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/g;
      for (const m of f.text.matchAll(dec)) {
        routes.push({
          method: m[1].toUpperCase(), path: join2(prefix, ctrl[1], m[2]), file, root: f.root,
          line: lineOf(f.text, m.index), handler: nextHandlerName(f.text, m.index),
        });
      }
    }
    const mount = mounts.get(resolve(f.abs)) ?? '';
    const ex = new RegExp(`\\b(?:router|app|r|api)\\.(${HTTP.join('|')})\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'g');
    for (const m of f.text.matchAll(ex)) {
      routes.push({ method: m[1].toUpperCase(), path: join2(mount, m[2]), file, root: f.root, line: lineOf(f.text, m.index) });
    }
    for (const pat of adapter.routePatterns ?? []) {
      for (const m of f.text.matchAll(new RegExp(pat, 'g'))) {
        const [method, path] = m.length > 2 ? [m[1], m[2]] : ['ANY', m[1]];
        routes.push({ method: String(method).toUpperCase(), path: join2(mount, path), file, root: f.root, line: lineOf(f.text, m.index) });
      }
    }
  }
  return routes;
}

// Path-like string literals in front-end code. A literal followed by `+ expr`
// gets a trailing parameter; adapter patterns add the wrapper's base path.
export function extractApiCalls(roots, adapter = {}) {
  const calls = [];
  for (const f of codeFiles(roots)) {
    const file = rel(f.root, f.abs);
    const seen = new Set();
    const push = (raw, index, method) => {
      const k = `${index}:${raw}`;
      if (seen.has(k)) return;
      seen.add(k);
      calls.push({ method, path: raw, norm: normalizePath(raw), file, root: f.root, line: lineOf(f.text, index), enclosing: enclosingFunction(f.text, lineOf(f.text, index)) });
    };
    for (const pat of adapter.apiClientPatterns ?? []) {
      for (const m of f.text.matchAll(new RegExp(pat, 'g'))) {
        const method = m.length > 2 ? m[1].toUpperCase() : undefined;
        let path = m.length > 2 ? m[2] : m[1];
        const tail = f.text.slice(m.index + m[0].length, m.index + m[0].length + 40);
        if (/^['"`]?\s*\+/.test(tail)) path += '/:p';
        push((adapter.apiBase ?? '') + path, m.index, method);
      }
    }
    const tpl = /`(\/[A-Za-z][^`\s]*)`/g;
    for (const m of f.text.matchAll(tpl)) push(m[1], m.index);
    const quoted = /(['"])(\/[A-Za-z][^'"\s]*)\1(\s*\+\s*[\w.$]+)?/g;
    for (const m of f.text.matchAll(quoted)) push(m[3] ? `${m[2]}/:p` : m[2], m.index);
  }
  return calls;
}

export function linkCalls(routes, calls) {
  const byNorm = new Map();
  for (const r of routes) {
    const n = normalizePath(r.path);
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n).push(r);
  }
  const links = [];
  for (const c of calls) {
    for (const r of byNorm.get(c.norm.replace(/\/:p\/:p/g, '/:p')) ?? []) {
      if (c.method && r.method !== c.method && r.method !== 'ALL' && r.method !== 'ANY') continue;
      links.push({ route: r, call: c });
    }
  }
  return links;
}

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'try', 'with']);

// Name of the function or method containing a 1-based line, by scanning upward.
export function enclosingFunction(text, line) {
  const lines = text.split(/\r?\n/);
  let depth = 0;
  for (let i = line - 1; i >= 0; i--) {
    const l = lines[i];
    const opens = (l.match(/\{/g) || []).length;
    const closes = (l.match(/\}/g) || []).length;
    if (i < line - 1) depth += closes - opens;
    if (depth >= 0 && i < line - 1 && opens <= closes) continue;
    let m = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/.exec(l);
    if (m) return m[1];
    m = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::\s*[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/.exec(l);
    if (m) return m[1];
    m = /^\s*(?:public\s+|private\s+|protected\s+|static\s+)*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*$/.exec(l);
    if (m && !KEYWORDS.has(m[1])) return m[1];
  }
  return null;
}
