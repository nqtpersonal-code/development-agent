import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

// Heavy dependencies live outside the plugin, in <dataDir>/runtime, and are
// installed one by one: a project only gets the driver of the database it uses.
export const RUNTIME_PACKAGES = ['pg', 'mysql2', 'mssql', 'playwright'];
// DB engine (as parseDbUrl names it) -> the driver package it needs.
export const ENGINE_PACKAGE = { postgres: 'pg', mysql: 'mysql2', sqlserver: 'mssql' };

export class NqtMissingRuntime extends Error {}

const runtimeDir = (dataDir) => join(dataDir, 'runtime');
const basePackage = (pkg) => String(pkg).split('/')[0];

// When on (the command line turns it on), a missing driver is installed the first
// time something needs it, instead of failing. Off by default, so library callers
// and tests never reach the network.
let autoInstall = false;
export function setAutoInstall(on) {
  autoInstall = Boolean(on);
}

const loader = (dataDir) => createRequire(join(runtimeDir(dataDir), 'package.json'));

export function hasPackage(dataDir, pkg) {
  try {
    loader(dataDir).resolve(pkg);
    return true;
  } catch {
    return false;
  }
}

// Loads a heavy dependency from <dataDir>/runtime so the plugin itself stays
// dependency-free and survives plugin updates.
export function runtimeRequire(dataDir, pkg) {
  const base = basePackage(pkg);
  try {
    return loader(dataDir)(pkg);
  } catch {
    if (autoInstall && RUNTIME_PACKAGES.includes(base)) {
      console.error(`nqt: installing "${base}" into ${runtimeDir(dataDir)} (this project needs it; one time)…`);
      try {
        installRuntime(dataDir, [base], { quiet: true });
        return loader(dataDir)(pkg);
      } catch (e) {
        throw new NqtMissingRuntime(`could not install "${base}": ${e.message}. Run: node <plugin>/scripts/nqt.mjs doctor --install ${base}`);
      }
    }
    throw new NqtMissingRuntime(
      `Missing runtime package "${base}". Run: node <plugin>/scripts/nqt.mjs doctor --install ${base} ` +
      `(installs into ${runtimeDir(dataDir)}); it is needed once.`,
    );
  }
}

// One command string with shell:true (args arrays with shell:true are deprecated
// in Node 24, and .cmd shims need a shell on Windows).
const sh = (command, opts = {}) => spawnSync(command, { shell: true, ...opts });
const q = (s) => `"${s}"`;

const has = (cmd) => {
  const r = sh(`${cmd} --version`, { encoding: 'utf8' });
  return r.status === 0 ? (r.stdout || r.stderr).split(/\r?\n/)[0].trim() : null;
};

function superpowersInstalled(pluginsFile) {
  try {
    const j = JSON.parse(readFileSync(pluginsFile, 'utf8'));
    return Object.keys(j.plugins ?? {}).some((k) => k.startsWith('superpowers@'));
  } catch {
    return false;
  }
}

// Installs exactly the named packages (default: all of them), skipping the ones
// already there. playwright also downloads its browser.
export function installRuntime(dataDir, names = RUNTIME_PACKAGES, { quiet = false } = {}) {
  const wanted = [...new Set(names.map(basePackage))];
  const unknown = wanted.filter((n) => !RUNTIME_PACKAGES.includes(n));
  if (unknown.length) throw new Error(`unknown runtime package(s): ${unknown.join(', ')} (have: ${RUNTIME_PACKAGES.join(', ')})`);
  const dir = runtimeDir(dataDir);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, 'package.json'))) {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'nqt-runtime', private: true }, null, 2));
  }
  const stdio = quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit';
  const fail = (what, r) => new Error(`${what} failed${quiet && r.stderr ? `: ${String(r.stderr).trim().split(/\r?\n/).slice(-2).join(' ')}` : ''}`);
  const missing = wanted.filter((n) => !hasPackage(dataDir, n));
  if (missing.length) {
    const npm = sh(`npm install --prefix ${q(dir)} --no-audit --no-fund ${missing.join(' ')}`, { stdio });
    if (npm.status !== 0) throw fail('npm install', npm);
  }
  if (wanted.includes('playwright')) {
    const pw = sh(`npx --prefix ${q(dir)} playwright install chromium`, { stdio, cwd: dir });
    if (pw.status !== 0) throw fail('playwright install chromium', pw);
  }
  return { installed: missing };
}

// Required: Node, git and the superpowers plugin. The runtime packages are never
// required up front: each is installed when a project's database (or a UI check)
// first needs it. `install` is the list of package names to install now.
export function doctor(dataDir, { install = [], pluginsFile } = {}) {
  const names = Array.isArray(install) ? install : [];
  if (names.length) installRuntime(dataDir, names);
  const file = pluginsFile ?? join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  const major = Number(process.versions.node.split('.')[0]);
  const checks = [
    { name: 'node', required: true, ok: major >= 20, detail: process.versions.node },
    { name: 'git', required: true, ok: Boolean(has('git')), detail: has('git') ?? 'not found' },
    { name: 'superpowers', required: true, ok: superpowersInstalled(file), detail: 'Claude Code plugin' },
    ...RUNTIME_PACKAGES.map((p) => {
      const ok = hasPackage(dataDir, p);
      return { name: `runtime:${p}`, required: false, ok, detail: ok ? runtimeDir(dataDir) : 'not installed (installed when a project needs it)' };
    }),
    { name: 'gh', required: false, ok: Boolean(has('gh')), detail: has('gh') ?? 'not found (ticket can be pasted)' },
    { name: 'glab', required: false, ok: Boolean(has('glab')), detail: has('glab') ?? 'not found (ticket can be pasted)' },
  ];
  return { ok: checks.every((c) => c.ok || !c.required), checks };
}
