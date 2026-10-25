import { existsSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { nameVariants } from './names.mjs';
import { searchCode } from './search.mjs';
import { relatedTables } from './schema.mjs';
import { extractRoutes, extractApiCalls, linkCalls, enclosingFunction } from './routes.mjs';
import { walkFiles, readText } from './files.mjs';

const DYNAMIC_SQL = /\$queryRawUnsafe|\$executeRawUnsafe|\b(?:FROM|JOIN|UPDATE|INTO)\s*['"`]\s*\+|\b(?:FROM|JOIN|UPDATE|INTO)\s+['"`]?\s*\$\{|\+\s*table\s*\+|\.raw\(\s*[A-Za-z_$]/i;
const JOB_HINT = /@Cron\b|\bcron\b|schedule|\bworker\b|\bqueue\b|consumer|\.job\.|jobs[\\/]/i;
const RANK = { 'confirmed-uses-column': 3, 'related-via-table': 2, suspected: 1 };
const MAX_CALLER_DEPTH = 4;

const posix = (p) => p.split(sep).join('/');

export function analyzeImpact({ start, schema, projectRoot, components, adapter = {}, maxDepth = 3 }) {
  const comps = components.map((c) => ({ ...c, abs: join(projectRoot, c.root) }));
  const present = comps.filter((c) => existsSync(c.abs));
  const unscanned = comps.filter((c) => !existsSync(c.abs)).map((c) => c.name);
  const be = present.filter((c) => c.kind !== 'fe').map((c) => c.abs);
  const fe = present.filter((c) => c.kind === 'fe').map((c) => c.abs);
  const notes = [];
  const places = new Map();
  const jobRe = adapter.jobPatterns?.length ? new RegExp([JOB_HINT.source, ...adapter.jobPatterns].join('|'), 'i') : JOB_HINT;
  const fileOf = (root, file) => posix(relative(projectRoot, join(root, file)));
  const layerOf = (absRoot, file, text) => {
    const comp = present.find((c) => c.abs === absRoot);
    if (/\.(prisma|sql)$/.test(file) || /seed/i.test(file)) return 'db';
    if (jobRe.test(file) || (text && /@Cron\b/.test(text))) return 'job';
    return comp?.kind === 'fe' ? 'fe' : 'be';
  };
  const add = (p) => {
    const cur = places.get(p.file);
    if (!cur) return void places.set(p.file, { ...p, id: `P${places.size + 1}` });
    if (RANK[p.certainty] > RANK[cur.certainty] && cur.certainty !== 'suspected') cur.certainty = p.certainty;
    for (const v of p.via ?? []) if (!cur.via.includes(v)) cur.via.push(v);
    cur.screen ??= p.screen;
  };

  const tableTerms = [...nameVariants(start.table), ...(adapter.aliases?.[start.table] ?? [])];
  const colTerms = start.column ? nameVariants(start.column) : tableTerms;
  const roots = present.map((c) => c.abs);

  // 1. Direct users of the column (near a mention of its table/model).
  const direct = searchCode({ roots, terms: colTerms, contextTerms: start.column ? tableTerms : [] });
  const byFile = new Map();
  const hitLines = new Map();
  for (const h of direct.hits) {
    const key = `${h.root}|${h.file}`;
    if (!byFile.has(key)) byFile.set(key, h);
    if (!hitLines.has(key)) hitLines.set(key, []);
    hitLines.get(key).push(h.line);
  }
  // 2. Column mentioned next to dynamic SQL, even without the table name.
  const loose = searchCode({ roots, terms: colTerms });
  for (const h of loose.hits) {
    const key = `${h.root}|${h.file}`;
    if (byFile.has(key)) continue;
    const text = readText(join(h.root, h.file)) ?? '';
    if (DYNAMIC_SQL.test(text)) byFile.set(key, h);
  }

  const related = schema ? relatedTables(schema, start.table, maxDepth).map((r) => r.table) : [];
  for (const h of byFile.values()) {
    const abs = join(h.root, h.file);
    const text = readText(abs) ?? '';
    const layer = layerOf(h.root, h.file, text);
    const dynamic = layer !== 'db' && DYNAMIC_SQL.test(text);
    const joins = related.filter((t) => new RegExp(`\\b${t}\\b`).test(text));
    add({
      layer,
      lines: hitLines.get(`${h.root}|${h.file}`) ?? [h.line],
      file: fileOf(h.root, h.file),
      line: h.line,
      root: h.root,
      relFile: h.file,
      via: joins.length ? [`joins ${joins.join(', ')}`] : [],
      certainty: dynamic ? 'suspected' : 'confirmed-uses-column',
      reason: dynamic ? 'column used in SQL built at runtime' : `uses ${h.term}`,
    });
    if (dynamic) notes.push(`dynamic SQL in ${fileOf(h.root, h.file)}: verify by reading the code`);
  }

  // 3. Walk callers upward in back-end code until a route is reached.
  const routes = extractRoutes(be, adapter);
  const reached = new Map();
  const beFiles = be.flatMap((root) => [...walkFiles(root)].map((abs) => ({ root, abs, text: readText(abs) ?? '' })));
  const routeAt = (absFile, line) => routes
    .filter((r) => join(r.root, r.file) === absFile && r.line <= line && line - r.line <= 60)
    .sort((x, y) => y.line - x.line)[0];
  let frontier = [...places.values()].filter((p) => p.layer !== 'fe' && p.layer !== 'db')
    .flatMap((p) => (p.lines ?? [p.line]).map((line) => ({ abs: join(p.root, p.relFile), line, chain: [p.file] })));
  const visited = new Set();
  for (let depth = 0; depth < MAX_CALLER_DEPTH && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      const r = routeAt(node.abs, node.line);
      if (r) {
        reached.set(`${r.method} ${r.path}`, { route: r, chain: node.chain });
        continue;
      }
      const text = readText(node.abs) ?? '';
      const fn = enclosingFunction(text, node.line);
      if (!fn || visited.has(`${node.abs}|${fn}`)) continue;
      visited.add(`${node.abs}|${fn}`);
      const modBase = basename(node.abs).replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, '');
      const callRe = new RegExp(`\\b${fn}\\s*\\(`);
      for (const f of beFiles) {
        if (f.abs === node.abs || !callRe.test(f.text) || !f.text.includes(modBase)) continue;
        const lines = f.text.split(/\r?\n/);
        lines.forEach((l, i) => {
          if (!callRe.test(l) || /\b(function|async)\s+\w+\s*\(/.test(l)) return;
          const file = fileOf(f.root, posix(relative(f.root, f.abs)));
          add({ layer: layerOf(f.root, file, f.text), file, line: i + 1, root: f.root, relFile: posix(relative(f.root, f.abs)), via: [`calls ${fn}() in ${node.chain.at(-1)}`], certainty: 'confirmed-uses-column', reason: `calls ${fn}()` });
          next.push({ abs: f.abs, line: i + 1, chain: [...node.chain, file] });
        });
      }
    }
    frontier = next;
  }
  if (!routes.length) notes.push('no API routes recognised in back-end code (adapter routePatterns may be needed)');

  // 4. Front-end code calling the reached routes, and the screens showing it.
  const calls = extractApiCalls(fe, adapter);
  const links = linkCalls([...reached.values()].map((x) => x.route), calls);
  for (const { route, call } of links) {
    const chain = reached.get(`${route.method} ${route.path}`)?.chain ?? [];
    add({ layer: 'fe', file: fileOf(call.root, call.file), line: call.line, root: call.root, relFile: call.file, via: [`${route.method} ${route.path}`, ...chain], certainty: 'confirmed-uses-column', reason: `calls ${route.method} ${route.path}` });
  }
  const screens = screenMap(fe);
  for (const p of places.values()) {
    if (p.layer !== 'fe') continue;
    const s = screens.get(join(p.root, p.relFile));
    if (s) p.screen = s;
  }

  const out = [...places.values()].map(({ root, relFile, lines, ...p }) => p);
  return { start, places: out, routes: [...reached.keys()], unscanned, notes: [...new Set(notes)] };
}

// Maps page component files to router paths (react-router <Route path element> and { path, element/component }).
function screenMap(feRoots) {
  const compPath = new Map();
  const files = feRoots.flatMap((root) => [...walkFiles(root)].filter((p) => /\.(tsx|jsx|ts|js|vue)$/.test(p)));
  for (const abs of files) {
    const text = readText(abs) ?? '';
    for (const m of text.matchAll(/path\s*[=:]\s*["'`]([^"'`]+)["'`][^>\n]*?(?:element\s*[=:]\s*\{?\s*<\s*|component\s*[=:]\s*\{?\s*)([A-Z]\w*)/g)) {
      compPath.set(m[2], m[1]);
    }
  }
  const out = new Map();
  for (const abs of files) {
    const text = readText(abs) ?? '';
    const name = /export\s+default\s+function\s+([A-Z]\w*)/.exec(text)?.[1] ?? basename(abs).replace(/\.\w+$/, '');
    if (compPath.has(name)) out.set(abs, compPath.get(name));
  }
  return out;
}

export function summarizeImpact(impact) {
  const by = (l) => impact.places.filter((p) => p.layer === l).length;
  const lines = [
    `impact of ${impact.start.table}${impact.start.column ? '.' + impact.start.column : ''}: ${impact.places.length} places (screens/fe ${by('fe')}, api/be ${by('be')}, jobs ${by('job')}, db ${by('db')})`,
    `routes reached: ${impact.routes.length ? impact.routes.join(', ') : 'none'}`,
    `suspected (verify by reading code): ${impact.places.filter((p) => p.certainty === 'suspected').map((p) => p.file).join(', ') || 'none'}`,
    `not scanned: ${impact.unscanned.join(', ') || 'nothing'}`,
  ];
  for (const n of impact.notes.slice(0, 4)) lines.push(`note: ${n}`);
  return lines;
}
