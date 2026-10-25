#!/usr/bin/env node
// nqt command-line entry point. Every command prints a short summary (<= 10
// lines) and writes full results to files when results are large.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDataDir, ensureDataDir, loadConfig, projectConfig } from './lib/config.mjs';

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
