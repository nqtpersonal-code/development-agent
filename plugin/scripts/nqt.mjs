#!/usr/bin/env node
// nqt command-line entry point. Every command prints a short summary (<= 10
// lines) and writes full results to files when results are large.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDataDir, ensureDataDir, loadConfig, projectConfig } from './lib/config.mjs';
import { STEPS, newState, readState, writeState, setStep, setWaiting, setFlag, resumeState } from './lib/state.mjs';
import { scanLeaks, projectNamesFrom } from './lib/leaks.mjs';
import { walkFiles, readText, rel } from './lib/files.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { doctor } from './lib/runtime.mjs';
import { nameVariants } from './lib/names.mjs';
import { searchCode } from './lib/search.mjs';
import { readSchema } from './lib/schema.mjs';
import { analyzeImpact, summarizeImpact } from './lib/impact.mjs';
import { loadAdapter, checkAssumptions, runAdapterTests, resolveDbUrl } from './lib/adapter.mjs';
import { resolve } from 'node:path';
import { uiCheck, summarizeUi } from './lib/uicheck.mjs';
import { parseDbUrl, assertLocalDb } from './lib/localhost.mjs';
import { findSiblings, tableVariants, columnVariants } from './lib/siblings.mjs';
import { blastRadius, summarizeRadius } from './lib/radius.mjs';
import { gitHistory, testCoverage } from './lib/risk.mjs';
import { detectHost, fetchTicket } from './lib/githost.mjs';
import { resolveProject, rememberProject } from './lib/project-id.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';

function projectContext(args) {
  const dataDir = getDataDir();
  const root = resolve(args.root ?? process.cwd());
  if (!args.project) {
    const found = resolveProject({ root, dataDir });
    if (!found.project) throw new Error('cannot tell which project this folder belongs to (no git remote); run: project --set <name>');
    args.project = found.project;
  }
  const fm = projectConfig(dataDir, args.project).project;
  const adapter = loadAdapter(dataDir, args.project);
  const components = adapter?.components ?? [{ name: 'project', root: '.', kind: 'be' }];
  const confirmedLocalHosts = [].concat(fm.confirmedLocalHosts ?? []).filter(Boolean);
  return { dataDir, root, fm, adapter, components, confirmedLocalHosts, dbUrl: args.db ?? resolveDbUrl(root, fm) };
}

function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      const value = next === undefined || next.startsWith('--') ? true : (i++, next);
      if (out[key] === undefined) out[key] = value;
      else out[key] = [].concat(out[key], value);
    } else out._.push(a);
  }
  return out;
}

const commands = {
  init() {
    const dataDir = getDataDir();
    const { created } = ensureDataDir(dataDir, pluginRoot);
    console.log(`data dir: ${dataDir}`);
    console.log(created.length ? `created: ${created.join(', ')}` : 'created: nothing (already set up)');
  },
  config(args) {
    const dataDir = getDataDir();
    const cfg = args.project ? projectConfig(dataDir, args.project) : loadConfig(dataDir);
    console.log(JSON.stringify(cfg, null, 2));
  },
  state(args) {
    const workDir = args._[0];
    if (!workDir) throw new Error('usage: state <workDir> [--init project ticket] [--resume] [--set step=status] [--wait kind text] [--clear-wait]');
    if (args.init) writeState(workDir, newState(args.init, args._[1] ?? ''));
    if (args.resume) resumeState(workDir);
    for (const pair of [].concat(args.set ?? [])) {
      const [step, status] = String(pair).split('=');
      setStep(workDir, step, status);
    }
    for (const pair of [].concat(args.flag ?? [])) {
      const [flag, value] = String(pair).split('=');
      setFlag(workDir, flag, value);
    }
    if (args.wait) setWaiting(workDir, { kind: args.wait, text: args._.slice(1).join(' ') });
    if (args['clear-wait']) setWaiting(workDir, null);
    const s = readState(workDir);
    if (!s) return void console.log('no state');
    const done = STEPS.filter((x) => ['done', 'skipped'].includes(s.steps[x])).length;
    console.log(`ticket ${s.project}/${s.ticket}: step ${s.current} (${done}/${STEPS.length} done)`);
    console.log(s.waitingFor ? `waiting: ${s.waitingFor.kind}: ${s.waitingFor.text}` : 'waiting: nothing');
  },
  doctor(args) {
    const dataDir = getDataDir();
    ensureDataDir(dataDir, pluginRoot);
    const r = doctor(dataDir, { install: Boolean(args.install) });
    for (const c of r.checks) {
      const mark = c.ok ? 'ok ' : c.required ? 'MISSING' : 'optional-missing';
      console.log(`${mark.padEnd(16)} ${c.name} — ${c.detail}`);
    }
    if (!r.ok) console.log('fix: node <plugin>/scripts/nqt.mjs doctor --install (and install the superpowers plugin if missing)');
    return r.ok ? 0 : 1;
  },
  search(args) {
    const roots = [].concat(args.root ?? []);
    const terms = [].concat(args.term ?? []).flatMap((t) => (args.exact ? [t] : nameVariants(t)));
    const contextTerms = [].concat(args.context ?? []).flatMap((t) => nameVariants(t));
    if (!roots.length || !terms.length) throw new Error('usage: search --root <dir>... --term <name>... [--context <name>...] [--exact] [--out file.json]');
    const r = searchCode({ roots, terms, contextTerms });
    if (args.out) writeJson(args.out, r);
    const byFile = {};
    for (const h of r.hits) byFile[h.file] = (byFile[h.file] ?? 0) + 1;
    const top = Object.entries(byFile).sort((a, b) => b[1] - a[1]);
    console.log(`search: ${r.hits.length} hits in ${top.length} files (${r.filesScanned} scanned, ${r.droppedNoContext} dropped without context${r.truncated ? ', TRUNCATED' : ''})`);
    for (const [f, n] of top.slice(0, 8)) console.log(`  ${n.toString().padStart(3)}  ${f}`);
    if (top.length > 8) console.log(`  … ${top.length - 8} more files${args.out ? ` in ${args.out}` : ''}`);
  },
  async schema(args) {
    if (!args.db && !args.project) throw new Error('usage: schema --project p [--root dir] | --db <url>  [--out file.json]');
    const ctx = args.project ? projectContext(args) : { dbUrl: args.db, dataDir: getDataDir(), confirmedLocalHosts: [] };
    if (!ctx.dbUrl) throw new Error('no DB settings in project.md (dbUrl or dbEnvFile)');
    const s = await readSchema(ctx.dbUrl, ctx.dataDir, ctx);
    s.columnVariants = columnVariants(s);
    if (args.out) writeJson(args.out, s);
    console.log(`schema (${s.engine}): ${s.tables.length} tables, ${s.fks.length} foreign keys, ${s.implicit.length} inferred relations, ${s.views.length} views, ${s.triggers.length} triggers`);
    for (const r of s.implicit.slice(0, 6)) console.log(`  inferred: ${r.from.table}.${r.from.column} -> ${r.to.table}.${r.to.column}`);
    for (const g of s.columnVariants.slice(0, 4)) console.log(`  look-alike columns (${g.reason}): ${g.columns.map((c) => `${c.table}.${c.column}`).join(', ')}`);
  },
  async impact(args) {
    const ctx = projectContext(args);
    if (!args.table) throw new Error('usage: impact --project p --table t [--column c] [--root dir] [--db url] [--out file.json]');
    if (ctx.dbUrl) assertLocalDb(ctx.dbUrl, ctx.confirmedLocalHosts);
    const schema = ctx.dbUrl ? await readSchema(ctx.dbUrl, ctx.dataDir, ctx).catch((e) => (console.log(`schema: unavailable (${e.message})`), null)) : null;
    const r = analyzeImpact({ start: { table: args.table, column: args.column }, schema, projectRoot: ctx.root, components: ctx.components, adapter: ctx.adapter ?? {} });
    if (!ctx.adapter) r.notes.push('no tracer adapter for this project yet: results use generic rules only');
    if (args.out) writeJson(args.out, r);
    for (const l of summarizeImpact(r)) console.log(l);
    return r.notes.some((n) => n.startsWith('adapter-assumption-failed')) ? 1 : 0;
  },
  'tracer-check'(args) {
    const ctx = projectContext(args);
    if (!ctx.adapter) {
      console.log(`no tracer adapter for ${args.project}`);
      return 1;
    }
    const res = checkAssumptions(ctx.adapter, ctx.root);
    for (const a of res) console.log(`${a.ok ? 'ok    ' : 'FAILED'} ${a.id} — ${a.description}`);
    return res.every((a) => a.ok) ? 0 : 1;
  },
  async 'tracer-test'(args) {
    const ctx = projectContext(args);
    const schema = ctx.dbUrl ? await readSchema(ctx.dbUrl, ctx.dataDir, ctx) : null;
    const res = runAdapterTests({ dataDir: ctx.dataDir, project: args.project, projectRoot: ctx.root, schema });
    for (const t of res) console.log(`${t.pass ? 'pass' : 'FAIL'} ${t.name}${t.pass ? '' : ' — missing: ' + t.missing.join(', ')}`);
    console.log(`${res.filter((t) => t.pass).length}/${res.length} tracer tests pass`);
    return res.every((t) => t.pass) ? 0 : 1;
  },
  async 'ui-check'(args) {
    if (!args.url || !args.out) throw new Error('usage: ui-check --url <url> --out <dir> [--login <json>] [--wait-for <selector>]');
    const login = args.login ? JSON.parse(args.login) : undefined;
    const r = await uiCheck({ url: args.url, outDir: args.out, login, waitFor: args['wait-for'] });
    for (const l of summarizeUi(r)) console.log(l);
    return r.issues.length ? 1 : 0;
  },
  siblings(args) {
    const ctx = projectContext(args);
    let r;
    if (args.table) {
      r = tableVariants({ table: args.table, projectRoot: ctx.root, components: ctx.components, aliases: ctx.adapter?.aliases?.[args.table] ?? [] });
      console.log(`siblings of table ${args.table}: ${r.functions.length} functions touch it`);
      for (const d of r.divergences) console.log(`  "${d.term}" used by ${d.usedBy.length}, missing in: ${d.missingIn.join('; ')}`);
      if (!r.divergences.length) console.log('  no diverging filter columns found');
    } else if (args.file && args.line) {
      r = findSiblings({ seed: { file: args.file, line: Number(args.line) }, projectRoot: ctx.root, components: ctx.components });
      console.log(`siblings of ${r.seed.name}() in ${r.seed.file}: ${r.siblings.length} candidates`);
      for (const s of r.siblings.slice(0, 6)) console.log(`  ${s.score}  ${s.file}:${s.start} ${s.name}${s.shared.length ? ` — shares ${s.shared.slice(0, 5).join(', ')}` : ''}${s.onlyInSeed.length ? ` — lacks ${s.onlyInSeed.slice(0, 3).join(', ')}` : ''}`);
    } else throw new Error('usage: siblings --project p [--root dir] (--table t | --file f --line n) [--out file.json]');
    if (args.out) writeJson(args.out, r);
  },
  radius(args) {
    const ctx = projectContext(args);
    if (!args.file || !args.function) throw new Error('usage: radius --project p [--root dir] --file f --function name [--out file.json]');
    const r = blastRadius({ file: args.file, fn: args.function, projectRoot: ctx.root, components: ctx.components, adapter: ctx.adapter ?? {} });
    if (args.out) writeJson(args.out, r);
    for (const l of summarizeRadius(r)) console.log(l);
  },
  'risk-signals'(args) {
    const ctx = projectContext(args);
    if (!args.file || !args.function) throw new Error('usage: risk-signals --project p [--root dir] --file f --function name [--days 180] [--out file.json]');
    const radius = blastRadius({ file: args.file, fn: args.function, projectRoot: ctx.root, components: ctx.components, adapter: ctx.adapter ?? {} });
    const history = gitHistory(ctx.root, args.file, { days: Number(args.days ?? 180) });
    const roots = ctx.components.map((c) => join(ctx.root, c.root));
    const tests = testCoverage(roots, [args.function, ...radius.routes.map((r) => r.split(' ')[1])]);
    const r = { radius, history, tests };
    if (args.out) writeJson(args.out, r);
    for (const l of summarizeRadius(radius)) console.log(l);
    console.log(`history (${history.days} days): ${history.commits ?? 'unknown'} commits, ${history.fixCommits ?? 'unknown'} bug fixes, last ${history.lastChanged ?? 'unknown'}`);
    console.log(`tests mentioning it or its routes: ${tests.files.length ? tests.files.join(', ') : 'none'}`);
  },
  project(args) {
    const dataDir = getDataDir();
    const root = resolve(args.root ?? process.cwd());
    if (typeof args.set === 'string') rememberProject({ root, dataDir, project: args.set });
    const r = resolveProject({ root, dataDir, explicit: typeof args.set === 'string' ? args.set : undefined });
    console.log(r.project ? `project: ${r.project} (${r.source})` : `project: unknown — ${r.source}`);
    return r.project ? 0 : 1;
  },
  'detect-host'(args) {
    const root = resolve(args.root ?? process.cwd());
    const remote = spawnSync('git', ['remote', 'get-url', args.remote ?? 'origin'], { cwd: root, encoding: 'utf8' });
    if (remote.status !== 0) {
      console.log('detect-host: no git remote found; ask the owner where the code and tickets live');
      return 1;
    }
    const r = detectHost(remote.stdout.trim());
    console.log(JSON.stringify(r));
    return r.host === 'unknown' ? 1 : 0;
  },
  'fetch-ticket'(args) {
    if (!args.ticket || !args.out) throw new Error('usage: fetch-ticket --project p [--root dir] --ticket <id|#id|url> --out <file>');
    const ctx = projectContext(args);
    let info = ctx.fm.gitHost && ctx.fm.repo ? { host: ctx.fm.gitHost, hostname: ctx.fm.gitHostname, repo: ctx.fm.repo } : null;
    if (!info) {
      const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: ctx.root, encoding: 'utf8' });
      info = remote.status === 0 ? detectHost(remote.stdout.trim()) : { host: 'unknown' };
    }
    const r = fetchTicket(info, String(args.ticket));
    if (!r.ok) {
      console.log(`fetch-ticket: need-ticket-paste — ${r.reason}`);
      return 3;
    }
    mkdirSync(dirname(args.out), { recursive: true });
    writeFileSync(args.out, r.markdown, 'utf8');
    console.log(`fetch-ticket: ${info.host} issue ${r.id} saved to ${args.out}`);
  },
  'db-check'(args) {
    const ctx = projectContext(args);
    if (!ctx.dbUrl) {
      console.log('db-check: no DB settings in project.md (dbUrl or dbEnvFile)');
      return 1;
    }
    const { engine, host, port, database } = parseDbUrl(ctx.dbUrl);
    try {
      assertLocalDb(ctx.dbUrl, ctx.confirmedLocalHosts);
      console.log(`db-check: ok — ${engine} on ${host}${port ? ':' + port : ''}/${database} is local`);
      return 0;
    } catch (e) {
      console.log(`db-check: BLOCKED — ${e.message}`);
      return 1;
    }
  },
  'scan-leaks'(args) {
    const projectNames = projectNamesFrom(getDataDir());
    let files;
    if (args.staged) {
      const names = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' })
        .split('\n').filter(Boolean);
      files = names.map((path) => ({ path, content: execFileSync('git', ['show', `:${path}`], { encoding: 'utf8', maxBuffer: 1 << 26 }) }));
    } else if (args.dir) {
      files = [...walkFiles(args.dir)].map((p) => ({ path: rel(args.dir, p), content: readText(p) ?? '' }));
    } else {
      throw new Error('usage: scan-leaks --staged | --dir <path>');
    }
    const findings = scanLeaks({ files, projectNames });
    if (!findings.length) {
      console.log(`leak scan: clean (${files.length} files, ${projectNames.length} project names checked)`);
      return 0;
    }
    console.log(`leak scan: ${findings.length} finding(s) — commit/export blocked`);
    for (const f of findings.slice(0, 20)) console.log(`  ${f.path}:${f.line} [${f.kind}] ${f.match}`);
    return 1;
  },
};

export async function main(argv) {
  const args = parseArgs(argv);
  const name = args._.shift();
  const cmd = commands[name];
  if (!cmd) {
    console.error(`usage: nqt.mjs <${Object.keys(commands).join('|')}> [options]`);
    return 2;
  }
  try {
    return (await cmd(args)) ?? 0;
  } catch (e) {
    console.error(`${name}: ${e.message}`);
    return 1;
  }
}

export function register(name, fn) {
  commands[name] = fn;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2));
}
