#!/usr/bin/env node
// Token cost of one ticket run, from Claude Code transcripts: the lead's
// session file(s) plus their subagents. Splits the cost by workflow step (from
// the lead's `state --set <step>=done` calls) and by agent type, so two plugin
// versions can be compared on the same ticket.
//
//   node tools/token-report.mjs <session.jsonl> [<session.jsonl> ...] [--json out.json]
//
// Several files = one ticket continued after /clear, in order.
// "Units" weigh each token kind by its price relative to plain input:
// input 1, cache write 5m 1.25, cache write 1h 2, cache read 0.1, output 5.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const STEPS = ['setup', 'analysis', 'screens', 'risk', 'brief', 'test-design', 'free-qa', 'architect', 'design', 'plan', 'plan-check', 'implement', 'review', 'qa', 'report', 'done'];
const W = { input: 1, write5m: 1.25, write1h: 2, read: 0.1, output: 5 };

const zero = () => ({ input: 0, write5m: 0, write1h: 0, read: 0, output: 0, calls: 0 });
const units = (t) => t.input * W.input + t.write5m * W.write5m + t.write1h * W.write1h + t.read * W.read + t.output * W.output;
function add(t, u) {
  const w1h = u.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const w5m = u.cache_creation?.ephemeral_5m_input_tokens ?? Math.max(0, (u.cache_creation_input_tokens ?? 0) - w1h);
  t.input += u.input_tokens ?? 0; t.write5m += w5m; t.write1h += w1h;
  t.read += u.cache_read_input_tokens ?? 0; t.output += u.output_tokens ?? 0; t.calls++;
}

const lines = (f) => readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

// One API response is logged on several lines (one per content block) with the
// same usage: count each message id once.
function usageOf(entries) {
  const seen = new Set();
  const out = [];
  for (const e of entries) {
    const m = e.message;
    if (!m?.usage || (m.id && seen.has(m.id))) continue;
    if (m.id) seen.add(m.id);
    out.push({ e, usage: m.usage, model: m.model });
  }
  return out;
}

const STEP_DONE = /--set\s+([\w-]+)=(done|skipped)/g;
// Steps that end in one call ("--set setup=done --set analysis=done") are
// joined ("setup+analysis"): their turns cannot be told apart.
function marker(c) {
  const cmd = String(c.input?.command ?? '');
  if (c.type !== 'tool_use' || !/nqt\.mjs/.test(cmd)) return null;
  const done = [...cmd.matchAll(STEP_DONE)].map((m) => m[1]).filter((s) => STEPS.includes(s) && s !== 'done');
  return done.length ? done.join('+') : null;
}

export function report(files) {
  const byStep = {};
  const byAgent = {};
  const lead = zero();
  const toolStep = new Map();
  const cell = (s) => (byStep[s] ??= { lead: zero(), agents: zero() });
  // Every turn up to and including the call that marks a step done belongs to
  // that step, so a step is found even when no earlier step was marked.
  const events = [];
  for (const f of files) {
    const entries = lines(f);
    const counted = new Set(usageOf(entries).map((x) => x.e));
    for (const e of entries) {
      const ev = { usage: counted.has(e) ? e.message.usage : null, tools: [], marks: null };
      for (const c of Array.isArray(e.message?.content) ? e.message.content : []) {
        if (c.type !== 'tool_use') continue;
        ev.tools.push(c.id);
        ev.marks = marker(c) ?? ev.marks;
      }
      events.push(ev);
    }
  }
  let step = 'after-report';
  for (let i = events.length - 1; i >= 0; i--) {
    const ev = events[i];
    if (ev.marks) step = ev.marks;
    if (ev.usage) { add(lead, ev.usage); add(cell(step).lead, ev.usage); }
    for (const id of ev.tools) toolStep.set(id, step);
  }
  for (const f of files) {
    const sub = join(dirname(f), basename(f, '.jsonl'), 'subagents');
    if (!existsSync(sub)) continue;
    for (const name of readdirSync(sub).filter((n) => n.endsWith('.jsonl'))) {
      const metaFile = join(sub, name.replace(/\.jsonl$/, '.meta.json'));
      const meta = existsSync(metaFile) ? JSON.parse(readFileSync(metaFile, 'utf8')) : {};
      const type = meta.agentType ?? 'unknown';
      const s = toolStep.get(meta.toolUseId) ?? 'unknown';
      const a = (byAgent[type] ??= { ...zero(), runs: 0 });
      a.runs++;
      for (const { usage } of usageOf(lines(join(sub, name)))) { add(a, usage); add(cell(s).agents, usage); }
    }
  }
  return { lead, byStep, byAgent };
}

const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)}k` : String(Math.round(n)));

function print(r) {
  const agentsTotal = Object.values(r.byAgent).reduce((s, a) => s + units(a), 0);
  const total = units(r.lead) + agentsTotal;
  console.log(`total units ${k(total)} — lead ${k(units(r.lead))} (${Math.round((100 * units(r.lead)) / total)}%, ${r.lead.calls} calls, cache read ${k(r.lead.read)}), agents ${k(agentsTotal)}`);
  console.log('\nstep          lead     agents   total');
  const order = (s) => (s === 'after-report' ? 98 : s === 'unknown' ? 99 : STEPS.indexOf(s.split('+')[0]));
  for (const s of Object.keys(r.byStep).sort((a, b) => order(a) - order(b))) {
    const c = r.byStep[s];
    console.log(`${s.padEnd(12)} ${k(units(c.lead)).padStart(7)} ${k(units(c.agents)).padStart(8)} ${k(units(c.lead) + units(c.agents)).padStart(8)}`);
  }
  console.log('\nagent                     runs    units  output');
  for (const [type, a] of Object.entries(r.byAgent).sort((x, y) => units(y[1]) - units(x[1]))) {
    console.log(`${type.padEnd(24)} ${String(a.runs).padStart(5)} ${k(units(a)).padStart(8)} ${k(a.output).padStart(7)}`);
  }
}

if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  const args = process.argv.slice(2);
  const ji = args.indexOf('--json');
  const out = ji >= 0 ? args.splice(ji, 2)[1] : null;
  if (!args.length) { console.error('usage: node tools/token-report.mjs <session.jsonl>... [--json out.json]'); process.exit(2); }
  const r = report(args);
  print(r);
  if (out) writeFileSync(out, JSON.stringify(r, null, 2));
}
