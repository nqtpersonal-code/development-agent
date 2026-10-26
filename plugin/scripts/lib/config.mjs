import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, cpSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

const DIRS = ['projects', 'work', 'patterns', 'review-rules', 'runtime'];

const DEFAULT_CONFIG = `---
# Language the team uses with you: vi (Vietnamese) or en (English).
language: vi
# Folder of your PERSONAL review rules (every .md inside is read). Empty = <data dir>/review-rules
reviewRules:
  personal:
# The plugin's source folder (git repo), so /nqt:retro proposes agent/workflow fixes in the right place. Empty: retro asks.
pluginSourceDir:
# Nicknames for agents and steps (used only when talking to you). Empty = default names.
nicknames:
  agents:
    # ba: Anna
    # qa: Tom
  steps:
    # analysis: Ticket deep-dive
---

# nqt configuration

Edit the values at the top of this file (between the two --- lines). Team review rules
go in projects/<project-name>/review-rules/.
`;

export function getDataDir() {
  return process.env.NQT_DATA_DIR || join(homedir(), '.claude', 'nqt');
}

export function ensureDataDir(dataDir, pluginRoot) {
  const created = [];
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  for (const d of DIRS) {
    const p = join(dataDir, d);
    if (!existsSync(p)) {
      mkdirSync(p, { recursive: true });
      created.push(d);
    }
  }
  const cfg = join(dataDir, 'config.md');
  if (!existsSync(cfg)) {
    writeFileSync(cfg, DEFAULT_CONFIG, 'utf8');
    created.push('config.md');
  }
  const starters = join(pluginRoot, 'starter-patterns');
  if (existsSync(starters)) {
    for (const pack of readdirSync(starters)) {
      const dest = join(dataDir, 'patterns', pack);
      if (!existsSync(dest)) {
        cpSync(join(starters, pack), dest, { recursive: true });
        created.push(`patterns/${pack}`);
      }
    }
  }
  return { created };
}

function readFm(path) {
  return existsSync(path) ? parseFrontmatter(readFileSync(path, 'utf8')) : {};
}

const asMap = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const asLang = (v) => (v === 'en' ? 'en' : 'vi');

export function loadConfig(dataDir) {
  const fm = readFm(join(dataDir, 'config.md'));
  const personal = typeof asMap(fm.reviewRules).personal === 'string' && asMap(fm.reviewRules).personal
    ? asMap(fm.reviewRules).personal
    : join(dataDir, 'review-rules');
  return {
    language: asLang(fm.language),
    reviewRules: { personal },
    pluginSourceDir: typeof fm.pluginSourceDir === 'string' && fm.pluginSourceDir ? fm.pluginSourceDir : '',
    nicknames: {
      agents: asMap(asMap(fm.nicknames).agents),
      steps: asMap(asMap(fm.nicknames).steps),
    },
  };
}

export function projectConfig(dataDir, project) {
  const base = loadConfig(dataDir);
  const fm = readFm(join(dataDir, 'projects', project, 'project.md'));
  return {
    ...base,
    project: fm,
    language: fm.language ? asLang(fm.language) : base.language,
    teamReviewRules: join(dataDir, 'projects', project, 'review-rules'),
  };
}
