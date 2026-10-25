import { dirname, join, resolve, sep } from 'node:path';
import { existsSync } from 'node:fs';
import { walkFiles, readText, rel } from './files.mjs';
import { signatureName } from './signatures.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte)$/;
const CSHARP = /\.cs$/;
const VIEWS = /\.(cshtml|razor)$/;
const HTTP = ['get', 'post', 'put', 'patch', 'delete', 'all'];

export function normalizePath(p) {
  let s = String(p).split('?')[0];
  s = s.replace(/\$\{[^}]*\}/g, ':p').replace(/:[A-Za-z_]\w*/g, ':p').replace(/\{[^}/]+\}/g, ':p');
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  return s || '/';
}

const join2 = (...parts) => '/' + parts.map((x) => String(x ?? '').replace(/^~?\/+|\/+$/g, '')).filter(Boolean).join('/');

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

function files(roots, re) {
  const out = [];
  for (const root of roots) for (const abs of walkFiles(root)) if (re.test(abs)) out.push({ root, abs, text: readText(abs) ?? '' });
  return out;
}

function globalPrefix(list) {
  for (const f of list) {
    const m = /setGlobalPrefix\(\s*['"`]([^'"`]+)['"`]/.exec(f.text);
    if (m) return m[1];
  }
  return '';
}

// Express mounts: app.use('/api/v1', require('./routes/x')) or app.use('/p', varName) with an import/require of varName.
function expressMounts(list) {
  const mounts = new Map();
  for (const f of list) {
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
  for (const l of text.slice(fromIndex).split('\n').slice(1, 6)) {
    if (/^\s*[@[]/.test(l)) continue;
    const name = signatureName(l);
    if (name) return name;
  }
  return undefined;
}

// ASP.NET Core controllers ([Route] + [HttpX] with [controller]/[action] tokens;
// conventional /{controller}/{action} when no attribute routes) and minimal APIs.
function aspnetRoutes(f, file) {
  const out = [];
  const lines = f.text.split(/\r?\n/);
  let pending = [];
  let ctrl = null;
  const groups = {};
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      pending.push(trimmed);
      return;
    }
    const cls = /\bclass\s+(\w+)\s*(?::\s*([^{]+))?/.exec(line);
    if (cls) {
      const isController = /Controller$/.test(cls[1]) || /\b(Controller|ControllerBase)\b/.test(cls[2] ?? '');
      const route = pending.map((a) => /\bRoute\(\s*"([^"]*)"/.exec(a)?.[1]).find((x) => x !== undefined);
      ctrl = isController ? { name: cls[1].replace(/Controller$/, ''), route, area: pending.map((a) => /\bArea\(\s*"([^"]*)"/.exec(a)?.[1]).find(Boolean) } : null;
      pending = [];
      return;
    }
    const sig = ctrl && trimmed && signatureName(line);
    if (sig && /\b(public)\b/.test(line)) {
      const attrs = pending.join(' ');
      const verbs = [...attrs.matchAll(/\bHttp(Get|Post|Put|Delete|Patch)\b(?:\(\s*"([^"]*)"\s*\))?/g)];
      const actionRoute = /\bRoute\(\s*"([^"]*)"/.exec(attrs)?.[1];
      const tokens = (p) => p.replace(/\[controller\]/gi, ctrl.name).replace(/\[action\]/gi, sig).replace(/\[area\]/gi, ctrl.area ?? '');
      const make = (method, tmpl) => {
        const t = tmpl ?? actionRoute;
        const path = t !== undefined && /^~?\//.test(t) ? join2(tokens(t)) : join2(tokens(ctrl.route ?? ''), tokens(t ?? ''));
        out.push({ method, path, file, root: f.root, line: i + 1, handler: sig });
      };
      if (verbs.length) for (const v of verbs) make(v[1].toUpperCase(), v[2]);
      else if (actionRoute !== undefined) make('ANY');
      else if (!ctrl.route && sig !== ctrl.name) {
        const action = sig.replace(/Async$/, '');
        out.push({ method: 'ANY', path: action === 'Index' ? join2(ctrl.name) : join2(ctrl.name, action), file, root: f.root, line: i + 1, handler: sig });
      }
    }
    if (trimmed) pending = [];
    const g = /\b(?:var|const)\s+(\w+)\s*=\s*(\w+)\.MapGroup\(\s*"([^"]*)"\s*\)/.exec(line);
    if (g) groups[g[1]] = join2(groups[g[2]] ?? '', g[3]);
    for (const m of line.matchAll(/(\w+)\.Map(Get|Post|Put|Delete|Patch)\(\s*"([^"]*)"/g)) {
      out.push({ method: m[2].toUpperCase(), path: join2(groups[m[1]] ?? '', m[3]), file, root: f.root, line: i + 1 });
    }
    for (const m of line.matchAll(/MapGroup\(\s*"([^"]*)"\s*\)\s*\.Map(Get|Post|Put|Delete|Patch)\(\s*"([^"]*)"/g)) {
      out.push({ method: m[2].toUpperCase(), path: join2(m[1], m[3]), file, root: f.root, line: i + 1 });
    }
  });
  return out;
}

// Razor Pages: a .cshtml starting with @page under a Pages folder is a screen and a GET route.
function razorPageRoutes(f, file) {
  const first = f.text.split(/\r?\n/).find((l) => l.trim());
  const m = /^\s*@page(?:\s+"([^"]*)")?/.exec(first ?? '');
  if (!m) return [];
  const parts = f.abs.split(sep);
  const at = parts.lastIndexOf('Pages');
  if (at < 0) return [];
  const segs = parts.slice(at + 1);
  segs[segs.length - 1] = segs.at(-1).replace(/\.cshtml$/, '');
  if (segs.at(-1) === 'Index') segs.pop();
  const path = join2(...segs, m[1] ?? '');
  const codeBehind = `${f.abs}.cs`;
  const target = existsSync(codeBehind) ? { file: `${file}.cs` } : { file };
  const verbs = existsSync(codeBehind) && /\bOnPost\w*\s*\(/.test(readText(codeBehind) ?? '') ? ['GET', 'POST'] : ['GET'];
  return verbs.map((method) => ({ method, path, ...target, root: f.root, line: 1, wholeFile: true, kind: 'razor-page' }));
}

export function extractRoutes(roots, adapter = {}) {
  const list = files(roots, CODE);
  const prefix = globalPrefix(list);
  const mounts = expressMounts(list);
  const routes = [];
  for (const f of list) {
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
  for (const f of files(roots, CSHARP)) routes.push(...aspnetRoutes(f, rel(f.root, f.abs)));
  for (const f of files(roots, /\.cshtml$/)) routes.push(...razorPageRoutes(f, rel(f.root, f.abs)));
  return routes;
}

// String constants declared in a file (const/readonly fields), so `${this.base}/x`
// and http.get(this.base) can be resolved. Leading unresolved ${...} (an API
// base URL from config) is dropped.
function fileConstants(text) {
  const out = {};
  for (const m of text.matchAll(/(?:const|let|var|readonly|private|public|protected|static)\s+(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*(?::[^=;]+)?=\s*(['"`])((?:(?!\2)[^\n])*)\2/g)) {
    out[m[1]] = m[3];
  }
  return out;
}

function resolveTemplate(raw, consts) {
  let s = raw.replace(/\$\{\s*(?:this\.)?([A-Za-z_$][\w$]*)\s*\}/g, (all, name) => (consts[name] !== undefined ? resolveTemplate(consts[name], consts) : all));
  s = s.replace(/^https?:\/\/[^/]+/, '');
  while (/^\$\{[^}]*\}\//.test(s)) s = s.replace(/^\$\{[^}]*\}/, '');
  return s;
}

// Front-end calls: path-like literals (JS/TS), resolved templates and constants,
// adapter wrapper patterns, Angular/HttpClient-style method calls, Blazor
// HttpClient calls and Razor tag helpers.
export function extractApiCalls(roots, adapter = {}, { only } = {}) {
  const calls = [];
  const list = files(roots, only ?? /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|razor|cshtml)$/);
  for (const f of list) {
    const file = rel(f.root, f.abs);
    const seen = new Set();
    const push = (raw, index, method) => {
      const k = `${index}:${raw}`;
      if (seen.has(k) || !raw.startsWith('/')) return;
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
    if (VIEWS.test(f.abs) || CSHARP.test(f.abs)) {
      for (const m of f.text.matchAll(/\.(Get|Post|Put|Delete|Patch)(?:FromJson|AsJson)?Async(?:<(?:[^<>()]|<[^<>()]*>)*>)?\(\s*\$?"([^"]+)"/g)) {
        push(`/${m[2].replace(/^\//, '')}`, m.index, m[1].toUpperCase());
      }
      for (const m of f.text.matchAll(/<[^>]*\basp-controller="(\w+)"[^>]*>/g)) {
        const action = /\basp-action="(\w+)"/.exec(m[0])?.[1] ?? 'Index';
        push(action === 'Index' ? `/${m[1]}` : `/${m[1]}/${action}`, m.index);
      }
      for (const m of f.text.matchAll(/\basp-page="([^"]+)"/g)) push(m[1].startsWith('/') ? m[1] : `/${m[1]}`, m.index);
      continue;
    }
    const consts = fileConstants(f.text);
    for (const m of f.text.matchAll(/`([^`\n]*)`/g)) {
      const resolved = resolveTemplate(m[1], consts);
      if (/^\/[A-Za-z]/.test(resolved)) push(resolved, m.index);
    }
    for (const m of f.text.matchAll(/\.(get|post|put|delete|patch)(?:<[^>()]*>)?\(\s*(?:this\.)?([A-Za-z_$][\w$]*)\s*[,)]/g)) {
      if (consts[m[2]] !== undefined) push(resolveTemplate(consts[m[2]], consts), m.index, m[1].toUpperCase());
    }
    const quoted = /(['"])(\/[A-Za-z][^'"\s]*)\1(\s*\+\s*[\w.$]+)?/g;
    for (const m of f.text.matchAll(quoted)) push(m[3] ? `${m[2]}/:p` : m[2], m.index);
  }
  return calls;
}

// Matches calls to routes by normalised path (case-insensitive, as ASP.NET is).
export function linkCalls(routes, calls) {
  const byNorm = new Map();
  for (const r of routes) {
    const n = normalizePath(r.path).toLowerCase();
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n).push(r);
  }
  const links = [];
  for (const c of calls) {
    for (const r of byNorm.get(c.norm.replace(/\/:p\/:p/g, '/:p').toLowerCase()) ?? []) {
      if (c.method && r.method !== c.method && r.method !== 'ALL' && r.method !== 'ANY') continue;
      links.push({ route: r, call: c });
    }
  }
  return links;
}

// Name of the function or method containing a 1-based line: walk upward, and
// at each block opener that contains the line (brace on the same line or alone
// on the next, Allman style) check whether it is a function signature.
export function enclosingFunction(text, line) {
  const lines = text.split(/\r?\n/);
  const own = lines[line - 1] ?? '';
  if (/=>/.test(own) || /\{\s*$/.test(own)) {
    const n = signatureName(own);
    if (n) return n;
  }
  if (/^\s*\{\s*$/.test(own)) {
    let k = line - 2;
    while (k >= 0 && !lines[k].trim()) k--;
    const n = signatureName(lines[k] ?? '');
    if (n) return n;
  }
  let depth = 0;
  for (let i = line - 2; i >= 0; i--) {
    const l = lines[i];
    depth += (l.match(/\}/g) || []).length - (l.match(/\{/g) || []).length;
    if (depth >= 0) continue;
    let cand = l;
    if (/^\s*\{\s*$/.test(l)) {
      let k = i - 1;
      while (k >= 0 && !lines[k].trim()) k--;
      cand = lines[k] ?? '';
    }
    const n = signatureName(cand);
    if (n) return n;
    depth = 0;
  }
  return null;
}
