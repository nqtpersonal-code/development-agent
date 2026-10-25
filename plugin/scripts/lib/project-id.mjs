import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseRemote } from './githost.mjs';

// Every ticket folder of a project shares the same git remote, so the remote
// (not the folder name) identifies the project.
export function projectIdFromRepo(repo) {
  return String(repo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const mapFile = (dataDir) => join(dataDir, 'projects', '_map.json');
const loadMap = (dataDir) => (existsSync(mapFile(dataDir)) ? JSON.parse(readFileSync(mapFile(dataDir), 'utf8')) : { remotes: {}, folders: {} });
const folderKey = (root) => resolve(root).toLowerCase();

function remoteOf(root) {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) return null;
  const p = parseRemote(r.stdout.trim());
  return p ? { key: `${p.hostname}/${p.repo.toLowerCase()}`, repo: p.repo } : null;
}

export function resolveProject({ root, dataDir, explicit }) {
  if (explicit) return { project: explicit, source: 'given' };
  const map = loadMap(dataDir);
  const folder = map.folders[folderKey(root)];
  if (folder) return { project: folder, source: 'remembered folder' };
  const remote = existsSync(root) ? remoteOf(root) : null;
  if (!remote) return { project: null, source: 'no git remote: ask the owner once' };
  if (map.remotes[remote.key]) return { project: map.remotes[remote.key], source: 'remembered remote' };
  return { project: projectIdFromRepo(remote.repo), source: 'git remote' };
}

// Remembers a chosen name: for the remote when there is one (so every folder
// cloned from it follows), otherwise for this folder.
export function rememberProject({ root, dataDir, project }) {
  const map = loadMap(dataDir);
  const remote = remoteOf(root);
  if (remote) map.remotes[remote.key] = project;
  else map.folders[folderKey(root)] = project;
  mkdirSync(join(dataDir, 'projects'), { recursive: true });
  writeFileSync(mapFile(dataDir), JSON.stringify(map, null, 2), 'utf8');
}
