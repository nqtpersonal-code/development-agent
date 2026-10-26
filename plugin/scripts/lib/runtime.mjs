import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

export const RUNTIME_PACKAGES = ['pg', 'mysql2', 'mssql', 'playwright'];

export class NqtMissingRuntime extends Error {}

const runtimeDir = (dataDir) => join(dataDir, 'runtime');

// Loads a heavy dependency from <dataDir>/runtime so the plugin itself stays
// dependency-free and survives plugin updates.
export function runtimeRequire(dataDir, pkg) {
  const dir = runtimeDir(dataDir);
  const req = createRequire(join(dir, 'package.json'));
  try {
    return req(pkg);
  } catch {
    throw new NqtMissingRuntime(
      `Missing runtime package "${pkg}". Run: node <plugin>/scripts/nqt.mjs doctor --install ` +
      `(installs into ${dir}); it is needed once.`,
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

export function installRuntime(dataDir) {
  const dir = runtimeDir(dataDir);
  mkdirSync(dir, { recursive: true });
  if (!existsSync(join(dir, 'package.json'))) {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'nqt-runtime', private: true }, null, 2));
  }
  const npm = sh(`npm install --prefix ${q(dir)} --no-audit --no-fund ${RUNTIME_PACKAGES.join(' ')}`, { stdio: 'inherit' });
  if (npm.status !== 0) throw new Error('npm install failed');
  const pw = sh(`npx --prefix ${q(dir)} playwright install chromium`, { stdio: 'inherit', cwd: dir });
  if (pw.status !== 0) throw new Error('playwright install chromium failed');
}

export function doctor(dataDir, { install = false, pluginsFile } = {}) {
  if (install) installRuntime(dataDir);
  const file = pluginsFile ?? join(homedir(), '.claude', 'plugins', 'installed_plugins.json');
  const req = createRequire(join(runtimeDir(dataDir), 'package.json'));
  const pkgOk = (p) => {
    try {
      req.resolve(p);
      return true;
    } catch {
      return false;
    }
  };
  const major = Number(process.versions.node.split('.')[0]);
  const checks = [
    { name: 'node', required: true, ok: major >= 20, detail: process.versions.node },
    { name: 'git', required: true, ok: Boolean(has('git')), detail: has('git') ?? 'not found' },
    { name: 'superpowers', required: true, ok: superpowersInstalled(file), detail: 'Claude Code plugin' },
    ...RUNTIME_PACKAGES.map((p) => ({ name: `runtime:${p}`, required: true, ok: pkgOk(p), detail: runtimeDir(dataDir) })),
    { name: 'docker', required: false, ok: Boolean(has('docker')), detail: has('docker') ?? 'not found' },
    { name: 'gh', required: false, ok: Boolean(has('gh')), detail: has('gh') ?? 'not found (ticket can be pasted)' },
    { name: 'glab', required: false, ok: Boolean(has('glab')), detail: has('glab') ?? 'not found (ticket can be pasted)' },
  ];
  return { ok: checks.every((c) => c.ok || !c.required), checks };
}
