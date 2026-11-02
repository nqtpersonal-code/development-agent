// Accuracy and token check for the code-tracer agent, without the owner:
// copies a fixture project to a temp folder, runs the installed nqt:code-tracer
// headless (`claude -p`) on each answer-key question, scores impact.md against
// the key and records turns, tokens and cost. Results go to tests/e2e/results/.
//
//   node tools/eval-tracer.mjs --fixture school-a|school-b|clinic|all [--question A-Q1] [--model sonnet] [--budget 3] [--keep]
//
// Needs the fixture's DB container running (docker compose in the fixture folder).
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmdirSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../plugin/scripts/nqt.mjs';
import { setupDetect } from '../plugin/scripts/lib/setup.mjs';
import { scoreImpact } from './eval-score.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(repoRoot, 'tests', 'fixtures');
// Folders copied per fixture, and the project root inside the copy (answer paths are relative to it).
const FIXTURES = {
  'school-a': { dirs: ['school-a'], root: 'school-a', db: 'tests/fixtures/school-a (docker compose up -d)' },
  'school-b': { dirs: ['school-b-api', 'school-b-web'], root: '.', db: 'tests/fixtures/school-b-api (docker compose up -d)' },
  clinic: { dirs: ['clinic'], root: 'clinic', db: 'tests/fixtures/clinic (docker compose up -d)' },
};
const SKIP = new Set(['node_modules', 'dist', 'bin', 'obj', '.vs', 'package-lock.json']);

const slash = (p) => p.replace(/\\/g, '/');
const realData = process.env.NQT_DATA_DIR || join(homedir(), '.claude', 'nqt');

function installedPlugin() {
  const file = join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  const entry = JSON.parse(readFileSync(file, 'utf8')).plugins?.['nqt@nqt-local']?.[0];
  if (!entry) throw new Error('nqt plugin is not installed (claude plugin install nqt@nqt-local --scope user)');
  const repoVersion = JSON.parse(readFileSync(join(repoRoot, 'plugin', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  if (entry.version !== repoVersion) console.log(`warning: installed nqt ${entry.version} differs from the repo's ${repoVersion}; run claude plugin marketplace update nqt-local && claude plugin update nqt@nqt-local`);
  return { path: entry.installPath, version: entry.version };
}

function nqt(plugin, dataDir, args) {
  const r = spawnSync(process.execPath, [join(plugin, 'scripts', 'nqt.mjs'), ...args], { encoding: 'utf8', env: { ...process.env, NQT_DATA_DIR: dataDir } });
  return { code: r.status, out: `${r.stdout}${r.stderr}`.trim() };
}

// A temp copy of the fixture and an isolated data dir sharing the real runtime packages.
function prepare(name, plugin, keyFile) {
  const spec = FIXTURES[name];
  const tmp = mkdtempSync(join(tmpdir(), `nqt-eval-${name}-`));
  for (const d of spec.dirs) cpSync(join(fixtures, d), join(tmp, d), { recursive: true, filter: (src) => !SKIP.has(basename(src)) });
  const root = spec.root === '.' ? tmp : join(tmp, spec.root);
  const dataDir = join(tmp, '_data');
  mkdirSync(dataDir, { recursive: true });
  if (existsSync(join(realData, 'runtime'))) symlinkSync(join(realData, 'runtime'), join(dataDir, 'runtime'), 'junction');
  nqt(plugin, dataDir, ['init']);
  const db = setupDetect(root).db.find((d) => d.local);
  if (!db) throw new Error(`${name}: no local DB settings found`);
  const project = `eval-${name}`;
  const fm = { name: project, writeTests: 'no', ...db.project };
  mkdirSync(join(dataDir, 'projects', project, 'tracer'), { recursive: true });
  writeFileSync(join(dataDir, 'projects', project, 'project.md'), `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n`, 'utf8');
  const key = JSON.parse(readFileSync(keyFile, 'utf8'));
  if (key.adapter) writeFileSync(join(dataDir, 'projects', project, 'tracer', 'adapter.json'), JSON.stringify({ ...key.adapter, components: key.components }, null, 2), 'utf8');
  else nqt(plugin, dataDir, ['tracer-need', '--project', project, '--root', root]);
  const ping = nqt(plugin, dataDir, ['sql', '--project', project, '--root', root, '--query', 'select 1 as ok']);
  if (ping.code !== 0) throw new Error(`${name}: DB not reachable — start it: ${spec.db}\n${ping.out}`);
  return { tmp, root, dataDir, project, key };
}

// Remove the link to the real runtime first, so deleting the copy never reaches the real packages.
function cleanup({ tmp, dataDir }) {
  const link = join(dataDir, 'runtime');
  if (existsSync(link) && lstatSync(link).isSymbolicLink()) {
    try {
      unlinkSync(link);
    } catch {
      rmdirSync(link);
    }
  }
  if (existsSync(link)) throw new Error(`could not unlink ${link}; remove ${tmp} by hand`);
  rmSync(tmp, { recursive: true, force: true });
}

// The tracer's own steps, read from its transcript: the method says scripts
// first, then code and data, and the output must pass the analysis check.
const STEPS_EXPECTED = [
  ['rules loaded', (cmds) => cmds.some((c) => /brief-for code-tracer/.test(c))],
  ['impact script', (cmds) => cmds.some((c) => /nqt\.mjs"?\s+impact\b/.test(c))],
  ['siblings', (cmds) => cmds.some((c) => /nqt\.mjs"?\s+siblings\b/.test(c))],
  ['real data', (cmds) => cmds.some((c) => /nqt\.mjs"?\s+sql\b/.test(c))],
  ['code opened', (cmds, reads) => reads > 0],
];

function processOf(root, work) {
  // Claude Code keeps a project's transcripts in a folder named after its path.
  // (the drive letter's case varies, so match the folder name case-insensitively).
  const projects = join(homedir(), '.claude', 'projects');
  const want = root.replace(/[:\\/.]/g, '-').toLowerCase();
  const name = existsSync(projects) ? readdirSync(projects).find((n) => n.toLowerCase() === want) : null;
  const dir = name ? join(projects, name) : join(projects, want);
  const cmds = [];
  let reads = 0;
  if (existsSync(dir)) {
    for (const s of readdirSync(dir).filter((f) => !f.endsWith('.jsonl'))) {
      const sub = join(dir, s, 'subagents');
      if (!existsSync(sub)) continue;
      for (const f of readdirSync(sub).filter((x) => x.endsWith('.jsonl'))) {
        for (const line of readFileSync(join(sub, f), 'utf8').split('\n')) {
          let j;
          try { j = JSON.parse(line); } catch { continue; }
          for (const c of j.type === 'assistant' ? j.message?.content ?? [] : []) {
            if (c.type !== 'tool_use') continue;
            if (c.input?.command) cmds.push(String(c.input.command));
            if (c.name === 'Read' && !/[\\/]_data[\\/]/.test(String(c.input?.file_path ?? ''))) reads++;
          }
        }
      }
    }
  }
  const steps = STEPS_EXPECTED.map(([name, ok]) => ({ name, ok: ok(cmds, reads) }));
  const check = spawnSync(process.execPath, [join(repoRoot, 'plugin', 'scripts', 'nqt.mjs'), 'check-work', work, '--step', 'analysis'], { encoding: 'utf8' });
  const problems = check.stdout.split('\n').filter((l) => l.startsWith('  - ')).map((l) => l.slice(4))
    // the eval runs the tracer alone: no ba.md is expected
    .filter((p) => !/^ba\.md/.test(p));
  return { steps, outputProblems: problems };
}

function runTracer({ plugin, dataDir, project, root, tmp, question, model, budget }) {
  const work = join(dataDir, 'work', project, `eval-${question.id}`);
  mkdirSync(work, { recursive: true });
  const start = Object.entries(question.start).map(([k, v]) => `${k} ${v}`).join(', ');
  const brief = [
    `PLUGIN="${slash(plugin)}"`, `DATA="${slash(dataDir)}"`, `PROJECT=${project}`, `PROJECT_ROOT="${slash(root)}"`,
    `WORK="${slash(work)}"`, 'LANGUAGE=en', 'TASK=trace',
    `Ticket question: ${question.question}`, `Start points: ${start}.`,
    'Trace it as your instructions say, write WORK/trace/impact.md and return your summary.',
  ].join('\n');
  // Dispatched by a thin session, as the lead does: an agent started with --agent
  // has no shell tool and could not run the nqt scripts.
  const prompt = `Dispatch the nqt:code-tracer agent (Agent tool) once with exactly the brief between the lines. Do nothing else yourself; when it returns, reply with its summary.\n---\n${brief}\n---`;
  const cmd = ['claude', '-p', '--model', model, '--output-format', 'json',
    '--allowedTools', '"Agent Bash PowerShell Read Grep Glob Write"', '--add-dir', `"${slash(tmp)}"`, '--max-budget-usd', String(budget)].join(' ');
  const t0 = Date.now();
  const r = spawnSync(cmd, { shell: true, cwd: root, input: prompt, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 30 * 60 * 1000, env: { ...process.env, NQT_DATA_DIR: dataDir } });
  let meta = {};
  try {
    meta = JSON.parse(r.stdout);
  } catch {
    meta = { error: (r.stderr || r.stdout || '').slice(0, 300) };
  }
  const impactFile = join(work, 'trace', 'impact.md');
  const impact = existsSync(impactFile) ? readFileSync(impactFile, 'utf8') : '';
  const u = meta.usage ?? {};
  return {
    score: impact ? scoreImpact(impact, question) : { id: question.id, recall: 0, missing: question.expectedPlaces.map((p) => p.file), found: [], falsePositives: [], procedures: [], note: 'no impact.md written' },
    process: processOf(root, work),
    turns: meta.num_turns ?? null,
    costUsd: meta.total_cost_usd ?? null,
    tokens: { input: u.input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, output: u.output_tokens ?? 0 },
    seconds: Math.round((Date.now() - t0) / 1000),
    error: meta.is_error ? meta.result : meta.error,
  };
}

const args = parseArgs(process.argv.slice(2));
const names = args.fixture === 'all' || !args.fixture ? Object.keys(FIXTURES) : [String(args.fixture)];
const model = String(args.model ?? 'sonnet');
const plugin = installedPlugin();
const results = [];
for (const name of names) {
  if (!FIXTURES[name]) throw new Error(`unknown fixture ${name} (have: ${Object.keys(FIXTURES).join(', ')})`);
  let env;
  try {
    env = prepare(name, plugin.path, join(fixtures, 'answers', `${name}.json`));
  } catch (e) {
    console.log(`${name}: skipped — ${e.message}`);
    continue;
  }
  for (const q of env.key.questions.filter((x) => !args.question || x.id === args.question)) {
    const r = runTracer({ plugin: plugin.path, ...env, question: q, model, budget: Number(args.budget ?? 3) });
    results.push({ fixture: name, question: q.id, ...r });
    const s = r.score;
    console.log(`${q.id}: recall ${s.recall}% (${s.found.length}/${s.found.length + s.missing.length}), wrong places ${s.falsePositives.length}, procedures ${s.procedures.filter((p) => p.found).length}/${s.procedures.length}, turns ${r.turns}, cost $${r.costUsd?.toFixed(2) ?? '?'}, ${r.seconds}s${r.error ? ` — error: ${r.error}` : ''}`);
    for (const m of s.missing) console.log(`   missing: ${m}`);
    for (const f of s.falsePositives) console.log(`   wrongly affected: ${f.file} — "${f.line}"`);
    console.log(`   process: ${r.process.steps.map((x) => `${x.name} ${x.ok ? 'yes' : 'NO'}`).join(', ')}`);
    for (const p of r.process.outputProblems) console.log(`   output: ${p}`);
  }
  if (!args.keep) cleanup(env);
  else console.log(`${name}: kept ${env.tmp}`);
}
const outDir = join(repoRoot, 'tests', 'e2e', 'results');
mkdirSync(outDir, { recursive: true });
const out = join(outDir, `tracer-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
writeFileSync(out, JSON.stringify({ pluginVersion: plugin.version, model, results }, null, 2), 'utf8');
console.log(`results: ${out}`);
