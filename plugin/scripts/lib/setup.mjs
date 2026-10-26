import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { walkFiles, rel } from './files.mjs';
import { readEnv, parseConnectionString } from './adapter.mjs';
import { parseDbUrl, isLocalHost } from './localhost.mjs';
import { detectComponents } from './health.mjs';
import { listRepos } from './workspace.mjs';

const ENV_FILE = /(^|\/)\.env(\.[\w-]+)?$/;
const APPSETTINGS = /(^|\/)appsettings(\.[\w-]+)?\.json$/i;
const DB_SCHEME = /^(postgres(ql)?|mysql|mariadb|sqlserver|mssql|sqlite|file):/i;
const TEST_FILE = /\.(test|spec)\.[cm]?[jt]sx?$|(^|\/)[^/]*Tests?\/[^/]*\.cs$|Tests?\.cs$/;

// Connection parts without the password: setup decides from these, then writes
// only the file and key names into project.md.
const candidate = (file, key, p, extra = {}) => ({ file, key, engine: p.engine, host: p.host, port: p.port, database: p.database, local: isLocalHost(p.host), ...extra });

const DRIVER_ENGINE = [[/^(mysql2?|mariadb)$/, 'mysql'], [/^(pg|postgres|pg-promise)$/, 'postgres'], [/^(mssql|tedious)$/, 'sqlserver']];
const PORT_ENGINE = { 3306: 'mysql', 5432: 'postgres', 1433: 'sqlserver' };

// DB engine for env files that only give HOST/PORT/NAME parts: an explicit
// setting, else the DB driver in the nearest package.json, else the port.
function guessEngine(root, envDir, hint, port) {
  if (/mysql|maria/i.test(hint)) return 'mysql';
  if (/postgres|pg/i.test(hint)) return 'postgres';
  if (/sqlserver|mssql/i.test(hint)) return 'sqlserver';
  for (let dir = envDir; ; dir = dirname(dir)) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      const j = JSON.parse(readFileSync(pkg, 'utf8'));
      for (const dep of Object.keys({ ...j.dependencies, ...j.devDependencies })) {
        const hit = DRIVER_ENGINE.find(([re]) => re.test(dep));
        if (hit) return hit[1];
      }
    }
    if (dir === root || dirname(dir) === dir) break;
  }
  return PORT_ENGINE[port] ?? PORT_ENGINE[String(port).slice(-4)] ?? 'postgres';
}

function envCandidates(root, file, abs) {
  const env = readEnv(abs);
  const out = [];
  for (const [k, v] of Object.entries(env)) if (DB_SCHEME.test(v)) out.push(candidate(file, k, parseDbUrl(v), { project: { dbEnvFile: file, dbEnvVar: k } }));
  for (const prefix of new Set(Object.keys(env).map((k) => /^(.*)HOST$/.exec(k)?.[1]).filter((p) => p !== undefined && env[`${p}NAME`] !== undefined))) {
    const port = Number(env[`${prefix}PORT`]) || null;
    const engine = guessEngine(root, dirname(abs), env[`${prefix}ENGINE`] ?? env[`${prefix}CONNECTION`] ?? env[`${prefix}DIALECT`] ?? '', port);
    const p = { engine, host: env[`${prefix}HOST`], port, database: env[`${prefix}NAME`] };
    out.push(candidate(file, `${prefix}HOST/PORT/USER/PASSWORD/NAME`, p, { project: { dbEnvFile: file, dbEngine: engine, ...(prefix !== 'DB_' ? { dbEnvPrefix: prefix } : {}) }, engineGuessed: true }));
  }
  return out;
}

function appSettingsCandidates(file, abs) {
  let all;
  try {
    all = JSON.parse(readFileSync(abs, 'utf8').replace(/^﻿/, '').replace(/^\s*\/\/.*$/gm, '')).ConnectionStrings ?? {};
  } catch {
    return [];
  }
  return Object.entries(all).filter(([, cs]) => typeof cs === 'string' && cs).map(([name, cs]) =>
    candidate(file, `ConnectionStrings:${name}`, parseConnectionString(cs), { project: { dbEnvFile: file, dbConnectionName: name } }));
}

function scriptsOf(root, component) {
  const dir = join(root, component.root);
  const pkg = join(dir, 'package.json');
  if (existsSync(pkg)) {
    const s = JSON.parse(readFileSync(pkg, 'utf8')).scripts ?? {};
    return Object.fromEntries(['dev', 'start', 'start:dev', 'serve', 'build', 'test'].filter((k) => s[k]).map((k) => [k, s[k]]));
  }
  const csproj = existsSync(dir) ? readdirSync(dir).find((n) => n.endsWith('.csproj')) : null;
  return csproj ? { run: `dotnet run --project ${component.root}/${csproj}` } : {};
}

// Everything setup needs to fill project.md, in one pass: repos, DB settings
// (never passwords), components with their run scripts, and test habits.
export function setupDetect(root) {
  const db = [];
  let testFiles = 0;
  for (const abs of walkFiles(root)) {
    const file = rel(root, abs);
    if (TEST_FILE.test(file)) testFiles++;
    if (ENV_FILE.test(file) && !/example|sample|template/i.test(file)) db.push(...envCandidates(root, file, abs));
    else if (APPSETTINGS.test(file)) db.push(...appSettingsCandidates(file, abs));
  }
  const components = detectComponents(root);
  return {
    repos: listRepos(root),
    db,
    components,
    scripts: Object.fromEntries(components.map((c) => [c.root, scriptsOf(root, c)])),
    tests: { files: testFiles, writeTestsGuess: testFiles === 0 ? 'no' : 'yes' },
  };
}
