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
import { gitHistory, testCoverage, riskLevel } from './lib/risk.mjs';
import { detectHost, fetchTicket } from './lib/githost.mjs';
import { resolveProject, rememberProject } from './lib/project-id.mjs';
import { listRepos, resolveComponents } from './lib/workspace.mjs';
import { snapshot, compareSnapshots, detectComponents, adapterNeeded } from './lib/health.mjs';
import { ruleSections, agentBrief, stepGuide } from './lib/docs.mjs';
import { planCheck } from './lib/plancheck.mjs';
import { setupDetect } from './lib/setup.mjs';
import { runSql } from './lib/sql.mjs';
import { appCheck } from './lib/appcheck.mjs';
import { parseTicketRef } from './lib/githost.mjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

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
  // Components found by remote may be absent from this ticket folder: point them at a
  // path that does not exist so analysis reports them as not scanned.
  const components = resolveComponents(root, adapter?.components ?? [{ name: 'project', root: '.', kind: 'be' }])
    .map((c) => (c.root === null ? { ...c, root: `.nqt-missing/${c.name}` } : c));
  const confirmedLocalHosts = [].concat(fm.confirmedLocalHosts ?? []).filter(Boolean);
  return { dataDir, root, fm, adapter, components, confirmedLocalHosts, dbUrl: args.db ?? resolveDbUrl(root, fm) };
}

function writeJson(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const slash = (p) => String(p).replace(/\\/g, '/');

function fetchTicketTo(ctx, ticket, out) {
  let info = ctx.fm.gitHost && ctx.fm.repo ? { host: ctx.fm.gitHost, hostname: ctx.fm.gitHostname, repo: ctx.fm.repo } : null;
  if (!info) {
    const repos = listRepos(ctx.root).filter((r) => r.key);
    const own = repos.find((r) => r.dir === '.') ?? (repos.length === 1 ? repos[0] : null);
    info = own ? detectHost(`https://${own.hostname}/${own.repo}`) : { host: 'unknown' };
    if (!own && repos.length > 1) {
      return { code: 3, message: `need-owner — ${repos.length} repos here; set gitHost, gitHostname and repo (where the issues live) in project.md` };
    }
  }
  const r = fetchTicket(info, ticket);
  if (!r.ok) {
    return { code: 3, message: `need-ticket-paste — ${r.reason}` };
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, r.markdown, 'utf8');
  return { code: 0, message: `${info.host} issue ${r.id} saved to ${out}` };
}

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

// Phase boundaries where a fresh session saves the most tokens.
const CLEAR_AFTER = ['free-qa', 'plan-check', 'implement'];

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
    let boundary = false;
    for (const pair of [].concat(args.set ?? [])) {
      const [step, status] = String(pair).split('=');
      setStep(workDir, step, status);
      if (CLEAR_AFTER.includes(step) && ['done', 'skipped'].includes(status)) boundary = true;
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
    if (boundary) console.log('boundary: suggest /clear now — run state --wait clear, tell the owner how to continue, and END your turn (do not start the next step)');
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
  'tracer-health'(args) {
    const ctx = projectContext(args);
    if (!ctx.adapter) {
      console.log(`no tracer adapter for ${args.project}`);
      return 1;
    }
    const file = join(ctx.dataDir, 'projects', args.project, 'tracer', 'health.json');
    const cur = snapshot({ projectRoot: ctx.root, components: ctx.components, adapter: ctx.adapter });
    if (args.save || !existsSync(file)) {
      writeJson(file, cur);
      console.log(`tracer-health: baseline saved (${cur.routes} routes, link rate ${cur.linkRate}, data libs: ${cur.dataLibs.join(', ') || 'none'})`);
      return 0;
    }
    const { drift } = compareSnapshots(JSON.parse(readFileSync(file, 'utf8')), cur);
    if (!drift.length) {
      console.log(`tracer-health: ok — no sign the adapter is outdated (link rate ${cur.linkRate})`);
      return 0;
    }
    console.log(`tracer-health: OUTDATED? ${drift.length} sign(s):`);
    for (const d of drift) console.log(`  [${d.kind}] ${d.detail}`);
    return 1;
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
  repos(args) {
    const root = resolve(args.root ?? process.cwd());
    const repos = listRepos(root);
    if (!repos.length) {
      console.log('repos: no git repository in this folder');
      return 1;
    }
    for (const r of repos) {
      const dir = join(root, r.dir);
      const branch = spawnSync('git', ['branch', '--show-current'], { cwd: dir, encoding: 'utf8' }).stdout.trim();
      const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).stdout.split(/\r?\n/).filter(Boolean).length;
      console.log(`${r.dir.padEnd(16)} ${r.repo ?? '(no remote)'} — branch ${branch || '(detached)'}${dirty ? `, ${dirty} uncommitted changes` : ', clean'}`);
    }
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
    const r = fetchTicketTo(projectContext(args), String(args.ticket), args.out);
    console.log(`fetch-ticket: ${r.message}`);
    return r.code;
  },
  'risk-level'(args) {
    const ctx = projectContext(args);
    if (!args.file || !args.function) throw new Error('usage: risk-level --project p [--root dir] --file f --function name [--copies n] [--data-change] [--days 180]');
    const radius = blastRadius({ file: args.file, fn: args.function, projectRoot: ctx.root, components: ctx.components, adapter: ctx.adapter ?? {} });
    const history = gitHistory(ctx.root, args.file, { days: Number(args.days ?? 180) });
    let copies = args.copies !== undefined ? Number(args.copies) : null;
    if (copies === null) {
      const lines = readFileSync(join(ctx.root, args.file), 'utf8').split(/\r?\n/);
      const def = lines.findIndex((l) => new RegExp(`\\b${args.function}\\s*(?:=|\\()`).test(l)) + 1;
      copies = 1 + findSiblings({ seed: { file: args.file, line: def + 1 }, projectRoot: ctx.root, components: ctx.components, minScore: 0.5 }).siblings.length;
    }
    const r = riskLevel({ copies, routes: radius.routes.length, screens: radius.screens.length, fixCommits: history.commits === null ? null : history.fixCommits, dataChange: Boolean(args['data-change']) });
    console.log(`risk-level: ${r.level}${r.reasons.length ? ` — ${r.reasons.join('; ')}` : ` — ${copies} copies, ${radius.routes.length} APIs, ${radius.screens.length} screens, ${history.fixCommits ?? 'unknown'} recent bug fixes`}`);
    return 0;
  },
  rules(args) {
    const topics = String(args.topics ?? '').split('|').map((t) => t.trim()).filter(Boolean);
    if (!topics.length) throw new Error('usage: rules --topics "Heading one|Heading two"');
    console.log(ruleSections(join(pluginRoot, 'shared', 'rules.md'), topics));
  },
  formats(args) {
    const sections = String(args.sections ?? '').split('|').map((t) => t.trim()).filter(Boolean);
    if (!sections.length) throw new Error('usage: formats --sections "Heading one|Heading two"');
    console.log(ruleSections(join(pluginRoot, 'shared', 'formats.md'), sections));
  },
  'tracer-need'(args) {
    const ctx = projectContext(args);
    if (ctx.adapter) {
      console.log('tracer-need: an adapter already exists (use tracer-check / tracer-health)');
      return 0;
    }
    const components = detectComponents(ctx.root);
    const r = adapterNeeded({ projectRoot: ctx.root, components });
    console.log(`components: ${components.map((c) => `${c.name} (${c.kind}, ${c.root})`).join(', ') || 'none detected'}`);
    if (r.needed) {
      console.log(`tracer-need: NEEDED — ${r.reasons.join('; ')}`);
      return 1;
    }
    const dir = join(ctx.dataDir, 'projects', args.project, 'tracer');
    writeJson(join(dir, 'adapter.json'), { version: 1, generated: 'auto: generic rules connect this project', components });
    writeJson(join(dir, 'health.json'), snapshot({ projectRoot: ctx.root, components }));
    console.log(`tracer-need: not needed — generic rules link ${r.linked}/${r.calls} front-end calls; saved components and a health baseline`);
    return 0;
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
  // One call at the start of /nqt:work-ticket: data dir, doctor, project,
  // config, work dir and state, and the ticket fetched when still missing.
  start(args) {
    const dataDir = getDataDir();
    ensureDataDir(dataDir, pluginRoot);
    const root = resolve(args.root ?? process.cwd());
    const ref = String(args.ticket ?? args._[0] ?? '');
    if (!ref) throw new Error('usage: start --ticket <id|#id|url> [--project <name>] [--root dir]');
    const doc = doctor(dataDir);
    const missing = doc.checks.filter((c) => c.required && !c.ok).map((c) => c.name);
    if (missing.length) {
      console.log(`start: MISSING ${missing.join(', ')} — runtime packages: doctor --install; superpowers: install the plugin`);
      return 1;
    }
    if (typeof args.project === 'string') rememberProject({ root, dataDir, project: args.project });
    const found = resolveProject({ root, dataDir, explicit: typeof args.project === 'string' ? args.project : undefined });
    if (!found.project) {
      console.log('start: need-project — no git remote here; ask the owner for a short project name, then re-run start with --project <name>');
      return 3;
    }
    const project = found.project;
    const cfg = projectConfig(dataDir, project);
    const ticket = parseTicketRef(ref) ?? ref.replace(/[^\w.-]+/g, '-');
    const work = join(dataDir, 'work', project, ticket);
    if (!readState(work)) writeState(work, newState(project, ticket));
    else resumeState(work);
    const s = readState(work);
    let ticketLine = 'ticket: saved earlier';
    if (!existsSync(join(work, 'ticket.md'))) {
      const r = fetchTicketTo(projectContext({ project, root }), ref, join(work, 'ticket.md'));
      ticketLine = `ticket: ${r.message}`;
    }
    const nick = Object.keys(cfg.nicknames.agents).length || Object.keys(cfg.nicknames.steps).length ? JSON.stringify(cfg.nicknames) : 'none';
    const done = STEPS.filter((x) => ['done', 'skipped'].includes(s.steps[x])).length;
    console.log(`PLUGIN="${slash(pluginRoot)}"\nDATA="${slash(dataDir)}"\nPROJECT=${project} (${found.source})\nPROJECT_ROOT="${slash(root)}"\nWORK="${slash(work)}"\nLANGUAGE=${cfg.language}`);
    console.log(`nicknames: ${nick}`);
    console.log(`project.md: ${existsSync(join(dataDir, 'projects', project, 'project.md')) ? 'present' : 'missing (setup will detect it)'}`);
    console.log(`step: ${s.current} (${done}/${STEPS.length} done); waiting: ${s.waitingFor ? `${s.waitingFor.kind}: ${s.waitingFor.text}` : 'nothing'}`);
    console.log(ticketLine);
    console.log(`next: guide --step ${s.current}`);
  },
  guide(args) {
    const step = args.step ?? args._[0];
    if (!step) throw new Error(`usage: guide --step <${STEPS.join('|')}>`);
    console.log(stepGuide(pluginRoot, String(step)));
  },
  'brief-for'(args) {
    const agent = args._[0] ?? args.agent;
    if (!agent) throw new Error('usage: brief-for <agent>');
    console.log(agentBrief(pluginRoot, String(agent)));
  },
  'setup-detect'(args) {
    const root = resolve(args.root ?? process.cwd());
    const r = setupDetect(root);
    if (args.out) writeJson(args.out, r);
    console.log(`repos: ${r.repos.map((x) => `${x.dir} (${x.key ?? 'no remote'})`).join(', ') || 'none'}`);
    console.log(`db settings: ${r.db.map((d) => `${d.file} ${d.key} → ${d.engine} ${d.host}${d.port ? ':' + d.port : ''}/${d.database} ${d.local ? 'local' : 'NOT LOCAL'}`).join('; ') || 'none found'}`);
    for (const c of r.components) console.log(`component ${c.name} (${c.kind}, ${c.root}): ${Object.entries(r.scripts[c.root] ?? {}).map(([k, v]) => `${k}=${v}`).join(', ') || 'no scripts'}`);
    console.log(`tests: ${r.tests.files} test files → writeTests guess: ${r.tests.writeTestsGuess}`);
    if (args.out) console.log(`full result: ${args.out}`);
  },
  'plan-check'(args) {
    const work = args.work ?? args._[0];
    if (!work) throw new Error('usage: plan-check <WORK> [--out-of-scope TC4,TC5]');
    const brief = readFileSync(join(work, 'ticket-brief.md'), 'utf8');
    const plan = readFileSync(join(work, 'plan.md'), 'utf8');
    const r = planCheck({ brief, plan, outOfScopeCriteria: String(args['out-of-scope'] ?? '').split(',').filter(Boolean) });
    console.log(`plan-check: ${r.verdict}`);
    if (r.uncoveredCriteria.length) console.log(`criteria with no task: ${r.uncoveredCriteria.join(', ')}`);
    if (r.missingMustPatch.length) console.log(`must-patch places not in the plan: ${r.missingMustPatch.join(', ')}`);
    if (r.touchesForbidden.length) console.log(`plan touches do-not-touch places: ${r.touchesForbidden.join(', ')}`);
    return r.verdict === 'pass' ? 0 : 1;
  },
  async sql(args) {
    const ctx = projectContext(args);
    if (!ctx.dbUrl) throw new Error('no DB settings in project.md (dbUrl or dbEnvFile)');
    const query = args.file ? readFileSync(String(args.file), 'utf8') : args.query;
    if (!query || query === true) throw new Error('usage: sql --project p --root dir (--query "…" | --file q.sql) [--write [--all-rows]] [--out rows.json]');
    const r = await runSql({ url: ctx.dbUrl, query: String(query), write: Boolean(args.write), allRows: Boolean(args['all-rows']), dataDir: ctx.dataDir, confirmedLocalHosts: ctx.confirmedLocalHosts, maxRows: Number(args.max ?? 50) });
    if (args.out) writeJson(args.out, r.rows);
    if (!r.rows.length) return void console.log(`sql: no rows${r.affected != null ? ` (${r.affected} affected)` : ''}`);
    console.log(`sql: ${r.total} row(s)${r.truncated ? `, first ${r.rows.length} kept` : ''}${args.out ? `, saved to ${args.out}` : ''}`);
    console.log(r.rows.slice(0, 10).map((row) => JSON.stringify(row)).join('\n'));
  },
  'app-check'(args) {
    const ports = [].concat(args.port ?? []).map(Number).filter(Boolean);
    if (!ports.length) throw new Error('usage: app-check --port <n> [--port <n>] [--root <component dir>]');
    const root = resolve(args.root ?? process.cwd());
    let bad = 0;
    for (const port of ports) {
      const r = appCheck({ port, root });
      if (r.status !== 'current') bad++;
      console.log(`port ${port}: ${r.status}${r.pid ? ` (pid ${r.pid}${r.watching ? ', reloads on change' : ''})` : ''} — ${r.advice}`);
    }
    return bad ? 1 : 0;
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
