import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { listRepos, remoteOf } from './workspace.mjs';

// Every ticket folder of a project shares the same git remote(s), so remotes
// (not folder names) identify the project.
export function projectIdFromRepo(repo) {
  return String(repo).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const mapFile = (dataDir) => join(dataDir, 'projects', '_map.json');
const loadMap = (dataDir) => (existsSync(mapFile(dataDir)) ? JSON.parse(readFileSync(mapFile(dataDir), 'utf8')) : { remotes: {}, folders: {} });
const folderKey = (root) => resolve(root).toLowerCase();

export function resolveProject({ root, dataDir, explicit }) {
  if (explicit) return { project: explicit, source: 'given' };
  const map = loadMap(dataDir);
  const folder = map.folders[folderKey(root)];
  if (folder) return { project: folder, source: 'remembered folder' };
  if (!existsSync(root)) return { project: null, source: 'folder not found' };
  const own = remoteOf(root);
  if (own) {
    if (map.remotes[own.key]) return { project: map.remotes[own.key], source: 'remembered remote' };
    return { project: projectIdFromRepo(own.repo), source: 'git remote' };
  }
  const repos = listRepos(root).filter((r) => r.key);
  const remembered = [...new Set(repos.map((r) => map.remotes[r.key]).filter(Boolean))];
  if (remembered.length === 1) return { project: remembered[0], source: 'remembered remotes' };
  if (repos.length === 1) return { project: projectIdFromRepo(repos[0].repo), source: 'git remote' };
  if (repos.length > 1) return { project: null, source: `ticket folder holds ${repos.length} repos: ask the owner for one shared project name` };
  return { project: null, source: 'no git remote: ask the owner once' };
}

// Remembers a chosen name for the folder's remote, or for every repo inside a
// ticket folder, so all later ticket folders cloned from them follow; a folder
// without any remote is remembered by path.
export function rememberProject({ root, dataDir, project }) {
  const map = loadMap(dataDir);
  const own = remoteOf(root);
  const keys = own ? [own.key] : listRepos(root).map((r) => r.key).filter(Boolean);
  if (keys.length) for (const k of keys) map.remotes[k] = project;
  else map.folders[folderKey(root)] = project;
  mkdirSync(join(dataDir, 'projects'), { recursive: true });
  writeFileSync(mapFile(dataDir), JSON.stringify(map, null, 2), 'utf8');
}
