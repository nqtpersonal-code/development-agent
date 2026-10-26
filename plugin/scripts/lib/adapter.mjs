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

export function readEnv(file) {
  if (!existsSync(file)) return {};
  const env = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return env;
}

// ADO.NET connection strings (SQL Server, Npgsql, MySQL) to their parts.
// Local SQL Server spellings (".", "(local)", "(localdb)\X") become localhost.
export function parseConnectionString(cs) {
  const kv = {};
  for (const part of String(cs).split(';')) {
    const i = part.indexOf('=');
    if (i > 0) kv[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim();
  }
  const server = kv.server ?? kv['data source'] ?? kv.host ?? kv.addr ?? kv.address ?? '';
  const m = /^(?:tcp:)?([^,\\]+)(?:\\[^,]+)?(?:,(\d+))?$/i.exec(server) ?? [];
  let host = m[1] ?? server;
  if (/^\((?:local|localdb)\)$/i.test(host) || host === '.') host = 'localhost';
  const port = m[2] ? Number(m[2]) : kv.port ? Number(kv.port) : null;
  const sqlServerish = kv['initial catalog'] || kv['trustservercertificate'] || kv['integrated security'] || kv['trusted_connection'] || kv['user id'] || /,\d+$|\\/.test(server);
  const engine = kv.host || kv.username ? 'postgres' : (kv.uid || kv.pwd) && !sqlServerish ? 'mysql' : 'sqlserver';
  return {
    engine,
    host,
    port,
    database: kv.database ?? kv['initial catalog'] ?? '',
    user: kv['user id'] ?? kv.uid ?? kv.username ?? kv.user ?? '',
    password: kv.password ?? kv.pwd ?? '',
  };
}

function readAppSettings(file, name) {
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/^\s*\/\/.*$/gm, '');
  const all = JSON.parse(text).ConnectionStrings ?? {};
  const cs = name ? all[name] : all.DefaultConnection ?? Object.values(all)[0];
  if (!cs) return null;
  const p = parseConnectionString(cs);
  const scheme = { sqlserver: 'sqlserver', postgres: 'postgresql', mysql: 'mysql' }[p.engine];
  const auth = p.user ? `${encodeURIComponent(p.user)}${p.password ? ':' + encodeURIComponent(p.password) : ''}@` : '';
  return `${scheme}://${auth}${p.host}${p.port ? ':' + p.port : ''}/${p.database}`;
}

// DB url from project.md keys: dbUrl | dbEnvFile + dbEnvVar | dbEnvFile with
// DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME parts (+ dbEngine) | dbEnvFile
// pointing at an appsettings*.json (+ dbConnectionName, default DefaultConnection).
export function resolveDbUrl(projectRoot, fm = {}) {
  if (fm.dbUrl) return fm.dbUrl;
  if (!fm.dbEnvFile) return null;
  if (/\.json$/i.test(fm.dbEnvFile)) return readAppSettings(join(projectRoot, fm.dbEnvFile), fm.dbConnectionName);
  const env = readEnv(join(projectRoot, fm.dbEnvFile));
  if (fm.dbEnvVar) return env[fm.dbEnvVar] ?? null;
  const p = (k) => env[`${fm.dbEnvPrefix ?? 'DB_'}${k}`];
  if (!p('HOST')) return env.DATABASE_URL ?? null;
  const engine = { mysql: 'mysql', sqlserver: 'sqlserver' }[fm.dbEngine] ?? 'postgresql';
  const auth = p('USER') ? `${encodeURIComponent(p('USER'))}${p('PASSWORD') ? ':' + encodeURIComponent(p('PASSWORD')) : ''}@` : '';
  return `${engine}://${auth}${p('HOST')}${p('PORT') ? ':' + p('PORT') : ''}/${p('NAME') ?? ''}`;
}
