#!/usr/bin/env node
// nqt command-line entry point. Every command prints a short summary (<= 10
// lines) and writes full results to files when results are large.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDataDir, ensureDataDir, loadConfig, projectConfig } from './lib/config.mjs';
import { STEPS, newState, readState, writeState, setStep, setWaiting } from './lib/state.mjs';

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
    if (!workDir) throw new Error('usage: state <workDir> [--init project ticket] [--set step=status] [--wait kind text] [--clear-wait]');
    if (args.init) writeState(workDir, newState(args.init, args._[1] ?? ''));
    for (const pair of [].concat(args.set ?? [])) {
      const [step, status] = String(pair).split('=');
      setStep(workDir, step, status);
    }
    if (args.wait) setWaiting(workDir, { kind: args.wait, text: args._.slice(1).join(' ') });
    if (args['clear-wait']) setWaiting(workDir, null);
    const s = readState(workDir);
    if (!s) return void console.log('no state');
    const done = STEPS.filter((x) => ['done', 'skipped'].includes(s.steps[x])).length;
    console.log(`ticket ${s.project}/${s.ticket}: step ${s.current} (${done}/${STEPS.length} done)`);
    console.log(s.waitingFor ? `waiting: ${s.waitingFor.kind}: ${s.waitingFor.text}` : 'waiting: nothing');
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
  return (await cmd(args)) ?? 0;
}

export function register(name, fn) {
  commands[name] = fn;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = await main(process.argv.slice(2));
}
