import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeImpact } from './impact.mjs';
import { checkAssumptions } from './assumptions.mjs';

export { checkAssumptions };

const dir = (dataDir, project) => join(dataDir, 'projects', project, 'tracer');

export function loadAdapter(dataDir, project) {
  const f = join(dir(dataDir, project), 'adapter.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

export function saveAdapter(dataDir, project, adapter) {
  mkdirSync(dir(dataDir, project), { recursive: true });
  writeFileSync(join(dir(dataDir, project), 'adapter.json'), JSON.stringify(adapter, null, 2), 'utf8');
}

export function loadAdapterTests(dataDir, project) {
  const f = join(dir(dataDir, project), 'tests.json');
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : [];
}

export function runAdapterTests({ dataDir, project, projectRoot, schema }) {
  const adapter = loadAdapter(dataDir, project);
  if (!adapter) throw new Error(`no tracer adapter for ${project}`);
  return loadAdapterTests(dataDir, project).map((t) => {
    const r = analyzeImpact({ start: t.start, schema, projectRoot, components: adapter.components, adapter });
    const byFile = new Map(r.places.map((p) => [p.file, p]));
    const missing = [];
    for (const e of t.expect) {
      const p = byFile.get(e.file);
      if (!p) missing.push(e.file);
      else if (e.viaIncludes && !p.via.some((v) => v.includes(e.viaIncludes))) missing.push(`${e.file} (via ${e.viaIncludes})`);
    }
    for (const n of r.notes.filter((x) => x.startsWith('adapter-assumption-failed'))) missing.push(n);
    return { name: t.name, pass: missing.length === 0, missing };
  });
}

function readEnv(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// DB url from project.md keys: dbUrl | dbEnvFile + dbEnvVar | dbEnvFile with
// DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME parts (+ dbEngine).
export function resolveDbUrl(projectRoot, fm = {}) {
  if (fm.dbUrl) return fm.dbUrl;
  if (!fm.dbEnvFile) return null;
  const env = readEnv(join(projectRoot, fm.dbEnvFile));
  if (fm.dbEnvVar) return env[fm.dbEnvVar] ?? null;
  const p = (k) => env[`${fm.dbEnvPrefix ?? 'DB_'}${k}`];
  if (!p('HOST')) return env.DATABASE_URL ?? null;
  const engine = fm.dbEngine === 'mysql' ? 'mysql' : 'postgresql';
  const auth = p('USER') ? `${encodeURIComponent(p('USER'))}${p('PASSWORD') ? ':' + encodeURIComponent(p('PASSWORD')) : ''}@` : '';
  return `${engine}://${auth}${p('HOST')}${p('PORT') ? ':' + p('PORT') : ''}/${p('NAME') ?? ''}`;
}
