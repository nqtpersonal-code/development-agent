import { existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { extractRoutes, extractApiCalls, linkCalls } from './routes.mjs';
import { walkCallers, screenMap, loadFiles } from './trace.mjs';
import { readText } from './files.mjs';

const posix = (p) => p.split(sep).join('/');

// Who depends on one function: its call sites (walking up to route handlers),
// the API routes reached and the screens calling those routes.
export function blastRadius({ file, fn, projectRoot, components, adapter = {} }) {
  const present = components.map((c) => ({ ...c, abs: join(projectRoot, c.root) })).filter((c) => existsSync(c.abs));
  const be = present.filter((c) => c.kind !== 'fe').map((c) => c.abs);
  const fe = present.filter((c) => c.kind === 'fe').map((c) => c.abs);
  const abs = join(projectRoot, file);
  const lines = (readText(abs) ?? '').split(/\r?\n/);
  const defLine = lines.findIndex((l) => new RegExp(`\\b${fn}\\s*(?:=|\\()`).test(l)) + 1;
  if (!defLine) throw new Error(`function ${fn} not found in ${file}`);
  const callers = [];
  const routes = extractRoutes(be, adapter);
  const reached = walkCallers({
    seeds: [{ abs, line: defLine + 1, label: file, fn }].map((s) => ({ ...s })),
    beFiles: loadFiles(be),
    routes,
    onCaller: (c) => callers.push({ file: posix(relative(projectRoot, c.abs)), line: c.line, enclosing: c.enclosing, calls: c.fn }),
  });
  const links = linkCalls([...reached.values()].map((x) => x.route), extractApiCalls(fe, adapter));
  const screensByFile = screenMap(fe);
  const feFiles = [...new Set(links.map((l) => join(l.call.root, l.call.file)))];
  return {
    fn, file,
    callers,
    routes: [...reached.keys()],
    feFiles: feFiles.map((f) => posix(relative(projectRoot, f))),
    screens: [...new Set(feFiles.map((f) => screensByFile.get(f)).filter(Boolean))],
  };
}

export function summarizeRadius(r) {
  return [
    `radius of ${r.fn}() in ${r.file}: ${r.callers.length} call sites, ${r.routes.length} API routes, ${r.screens.length} screens`,
    `routes: ${r.routes.join(', ') || 'none'}`,
    `screens: ${r.screens.join(', ') || 'none'}`,
    ...r.callers.slice(0, 6).map((c) => `  called from ${c.file}:${c.line}${c.enclosing ? ` (${c.enclosing})` : ''}`),
  ];
}
