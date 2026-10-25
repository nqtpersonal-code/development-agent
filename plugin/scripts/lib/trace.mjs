import { basename, join } from 'node:path';
import { walkFiles, readText } from './files.mjs';
import { enclosingFunction } from './routes.mjs';
import { declares } from './signatures.mjs';

export const MAX_CALLER_DEPTH = 4;

export function loadFiles(roots) {
  return roots.flatMap((root) => [...walkFiles(root)].map((abs) => ({ root, abs, text: readText(abs) ?? '' })));
}

// Names other files use to reach code in this file: the module name, its
// classes, and the interfaces they implement (C# DI calls through IFoo).
function referenceNames(abs, text) {
  const names = new Set([basename(abs).replace(/\.(ts|tsx|js|jsx|mjs|cjs|cs)$/, '')]);
  for (const m of text.matchAll(/\bclass\s+(\w+)(?:<[^>]*>)?\s*(?::\s*([^{\n]+)|extends\s+\w+\s+implements\s+([^{\n]+)|implements\s+([^{\n]+))?/g)) {
    names.add(m[1]);
    for (const part of (m[2] ?? m[3] ?? m[4] ?? '').split(',')) {
      const n = part.trim().split(/[<\s(]/)[0];
      if (n && /^[A-Z]/.test(n)) names.add(n);
    }
  }
  return [...names];
}

// Walks from seed lines up through the functions that call them (by name, in
// files that reference the seed's module, class or interfaces, or in the same
// file) until a route handler is reached. Calls onCaller for every call site.
export function walkCallers({ seeds, beFiles, routes, maxDepth = MAX_CALLER_DEPTH, onCaller = () => {} }) {
  const reached = new Map();
  const visited = new Set();
  const routeAt = (absFile, line) => routes
    .filter((r) => join(r.root, r.file) === absFile && (r.wholeFile || (r.line <= line && line - r.line <= 60)))
    .sort((x, y) => y.line - x.line)[0];
  let frontier = seeds.map((s) => ({ abs: s.abs, line: s.line, fn: s.fn, chain: [s.label ?? s.abs] }));
  for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      const r = routeAt(node.abs, node.line);
      if (r) {
        reached.set(`${r.method} ${r.path}`, { route: r, chain: node.chain });
        continue;
      }
      const fn = node.fn ?? enclosingFunction(readText(node.abs) ?? '', node.line);
      if (!fn || visited.has(`${node.abs}|${fn}`)) continue;
      visited.add(`${node.abs}|${fn}`);
      const refs = referenceNames(node.abs, readText(node.abs) ?? '');
      const callRe = new RegExp(`\\b${fn}\\s*(?:<[^>()]*>)?\\(`);
      for (const f of beFiles) {
        const same = f.abs === node.abs;
        if (!callRe.test(f.text) || (!same && !refs.some((n) => f.text.includes(n)))) continue;
        f.text.split(/\r?\n/).forEach((l, i) => {
          if (!callRe.test(l) || declares(l, fn)) return;
          const caller = { root: f.root, abs: f.abs, line: i + 1, fn, enclosing: enclosingFunction(f.text, i + 1), from: node.chain.at(-1) };
          onCaller(caller);
          next.push({ abs: f.abs, line: i + 1, chain: [...node.chain, f.abs] });
        });
      }
    }
    frontier = next;
  }
  return reached;
}

// Maps page component files to router paths: react-router <Route path element>,
// { path, element/component } objects (Angular routes included).
export function screenMap(feRoots) {
  const compPath = new Map();
  const files = feRoots.flatMap((root) => [...walkFiles(root)].filter((p) => /\.(tsx|jsx|ts|js|vue)$/.test(p)));
  for (const abs of files) {
    const text = readText(abs) ?? '';
    for (const m of text.matchAll(/path\s*[=:]\s*["'`]([^"'`]*)["'`][^>\n]*?(?:element\s*[=:]\s*\{?\s*<\s*|component\s*[=:]\s*\{?\s*)([A-Z]\w*)/g)) {
      compPath.set(m[2], m[1].startsWith('/') ? m[1] : `/${m[1]}`);
    }
  }
  const out = new Map();
  for (const abs of files) {
    const text = readText(abs) ?? '';
    const names = [
      /export\s+default\s+function\s+([A-Z]\w*)/.exec(text)?.[1],
      ...[...text.matchAll(/export\s+class\s+([A-Z]\w*)/g)].map((m) => m[1]),
      basename(abs).replace(/\.\w+$/, ''),
    ].filter(Boolean);
    const hit = names.find((n) => compPath.has(n));
    if (hit) out.set(abs, compPath.get(hit));
  }
  return out;
}
