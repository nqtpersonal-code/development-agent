import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { extractRoutes, extractApiCalls, linkCalls, normalizePath } from './routes.mjs';
import { walkFiles, readText } from './files.mjs';

const posix = (p) => p.split(sep).join('/');
const DATA_LIBS = [
  '@prisma/client', 'prisma', 'typeorm', 'sequelize', 'knex', 'mysql2', 'mysql', 'pg', 'mongoose', 'mongodb',
  'drizzle-orm', '@mikro-orm/core', 'objection', 'better-sqlite3', 'sqlite3', 'redis', 'ioredis', 'bullmq', 'bull',
  'amqplib', 'kafkajs', '@nestjs/typeorm', '@nestjs/sequelize', '@nestjs/mongoose',
];
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage', '.superpowers']);
const BUILTIN_CALLERS = /^(fetch|axios(\.\w+)?|require|import|navigate|router\.(push|replace)|history\.push|redirect|describe|it|test)$/;

function packages(root, depth = 3) {
  const out = [];
  const visit = (dir, d) => {
    if (existsSync(join(dir, 'package.json'))) out.push(posix(relative(root, dir)) || '.');
    if (d >= depth) return;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (!SKIP_DIRS.has(name) && !name.startsWith('.') && statSync(p).isDirectory()) visit(p, d + 1);
    }
  };
  visit(root, 0);
  return out.sort();
}

function deps(root, pkgDir) {
  try {
    const j = JSON.parse(readFileSync(join(root, pkgDir, 'package.json'), 'utf8'));
    return Object.keys({ ...j.dependencies, ...j.devDependencies });
  } catch {
    return [];
  }
}

// Functions called with a path-like first argument in front-end code, with counts.
function callHelpers(feRoots) {
  const counts = {};
  for (const root of feRoots) {
    for (const abs of walkFiles(root)) {
      if (!/\.(tsx?|jsx?|vue|svelte)$/.test(abs)) continue;
      for (const m of (readText(abs) ?? '').matchAll(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?)\s*(?:<[^>()]*>)?\(\s*['"`]\/[A-Za-z]/g)) {
        if (!BUILTIN_CALLERS.test(m[1])) counts[m[1]] = (counts[m[1]] ?? 0) + 1;
      }
    }
  }
  return counts;
}

// How the project is built, at a point in time: compared later to spot an outdated adapter.
export function snapshot({ projectRoot, components, adapter = {} }) {
  const present = components.filter((c) => c.root && existsSync(join(projectRoot, c.root)));
  const be = present.filter((c) => c.kind !== 'fe').map((c) => join(projectRoot, c.root));
  const fe = present.filter((c) => c.kind === 'fe').map((c) => join(projectRoot, c.root));
  const pkgs = packages(projectRoot);
  const inComponent = (p) => present.some((c) => p === c.root || p.startsWith(`${c.root}/`) || c.root.startsWith(`${p}/`) || c.root === '.');
  const routes = extractRoutes(be, adapter);
  const calls = extractApiCalls(fe, adapter);
  const prefixes = new Set(routes.map((r) => normalizePath(r.path).split('/')[1]).filter(Boolean));
  const apiLike = calls.filter((c) => prefixes.has(c.norm.split('/')[1]));
  const linked = new Set(linkCalls(routes, apiLike).map((l) => `${l.call.file}:${l.call.line}:${l.call.norm}`));
  const apiLikeKeys = new Set(apiLike.map((c) => `${c.file}:${c.line}:${c.norm}`));
  return {
    takenAt: new Date().toISOString(),
    components: present.map((c) => c.name),
    packages: pkgs,
    unknownPackages: pkgs.filter((p) => !inComponent(p)),
    dataLibs: [...new Set(pkgs.flatMap((p) => deps(projectRoot, p)).filter((d) => DATA_LIBS.includes(d)))].sort(),
    routes: routes.length,
    linkRate: apiLikeKeys.size ? Math.round((linked.size / apiLikeKeys.size) * 100) / 100 : 1,
    callHelpers: callHelpers(fe),
  };
}

export function compareSnapshots(base, cur) {
  const drift = [];
  for (const [name, n] of Object.entries(cur.callHelpers)) {
    if (n >= 3 && (base.callHelpers[name] ?? 0) < 3) drift.push({ kind: 'new-call-helper', detail: `front end calls the server through "${name}" in ${n} places; the adapter may not know it` });
  }
  for (const p of cur.unknownPackages) if (!base.packages.includes(p)) drift.push({ kind: 'new-package', detail: `new package "${p}" is not a component of the adapter` });
  for (const lib of cur.dataLibs) if (!base.dataLibs.includes(lib)) drift.push({ kind: 'new-data-library', detail: `new data library "${lib}"` });
  if (base.linkRate - cur.linkRate > 0.1) drift.push({ kind: 'link-rate-drop', detail: `front-end calls linked to routes fell from ${base.linkRate} to ${cur.linkRate}` });
  if (cur.routes < base.routes * 0.8) drift.push({ kind: 'routes-drop', detail: `recognised API routes fell from ${base.routes} to ${cur.routes}` });
  return { drift };
}
