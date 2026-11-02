import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Returns only the requested "## " sections of a markdown file, so each agent
// reads the rules it needs instead of the whole document.
export function ruleSections(file, headings) {
  const text = readFileSync(file, 'utf8');
  const parts = text.split(/^(?=## )/m);
  const byTitle = new Map(parts.filter((p) => p.startsWith('## ')).map((p) => [p.split('\n')[0].slice(3).trim(), p.trimEnd()]));
  return headings.map((h) => {
    const sec = byTitle.get(h.trim());
    if (!sec) throw new Error(`no section "${h}" in ${file} (have: ${[...byTitle.keys()].join(', ')})`);
    return sec;
  }).join('\n\n');
}

const WORK = 'Ticket work files (in `<work>`)';
const ASK = 'Owner questions';

// What each agent must know, fetched in one command (`nqt.mjs brief-for <agent>`).
export const AGENT_SECTIONS = {
  setup: { rules: ['Local DB guard', 'Repo hygiene', 'Commands', 'Token discipline'], formats: ['project.md', 'tracer/adapter.json', 'state.json (in `<work>`)', ASK] },
  ba: { rules: ['Natural-language interface', 'Owner-facing words', 'Source labels', 'Never guess', 'Code and DB are truth', 'When a rule is relaxed', 'One business rule, many implementations', 'Token discipline'], formats: [WORK, ASK] },
  'code-tracer': { rules: ['Code and DB are truth', 'When a rule is relaxed', 'When the owner doubts a conclusion', 'Local DB guard', 'Natural-language interface', 'One business rule, many implementations', 'Commands', 'Token discipline'], formats: [WORK, 'tracer/adapter.json'] },
  'screen-designer': { rules: ['Natural-language interface', 'Owner-facing words', 'Pattern library priority', 'One business rule, many implementations', 'Token discipline'], formats: [WORK, ASK] },
  'system-explainer': { rules: ['Code and DB are truth', 'When a rule is relaxed', 'When the owner doubts a conclusion', 'Natural-language interface', 'Owner-facing words', 'Source labels', 'Local DB guard', 'One business rule, many implementations', 'Commands', 'Token discipline'], formats: [] },
  architect: { rules: ['Surgical changes', 'Pattern library priority', 'Code and DB are truth', 'Preserve the scene', 'Natural-language interface', 'Owner-facing words', 'Token discipline'], formats: [WORK, ASK] },
  'risk-analyst': { rules: ['Preserve the scene', 'When a rule is relaxed', 'One business rule, many implementations', 'Commands', 'Natural-language interface', 'Owner-facing words', 'Token discipline'], formats: [WORK, ASK] },
  'plan-checker': { rules: ['Surgical changes', 'Never guess', 'Preserve the scene', 'Repo hygiene', 'Commands', 'Token discipline'], formats: [] },
  reviewer: { rules: ['Natural-language interface', 'Owner-facing words', 'Surgical changes', 'Repo hygiene', 'Local DB guard', 'Confidentiality', 'Preserve the scene', 'One business rule, many implementations', 'Pattern library priority', 'Token discipline'], formats: [WORK] },
  dev: { rules: ['Surgical changes', 'Never guess', 'Repo hygiene', 'Local DB guard', 'Preserve the scene', 'One business rule, many implementations', 'Pattern library priority', 'Commands', 'Token discipline'], formats: [WORK] },
  reporter: { rules: ['Natural-language interface', 'Owner-facing words', 'Source labels', 'Repo hygiene', 'Confidentiality', 'Commands', 'Token discipline'], formats: [WORK] },
  qa: { rules: ['Local DB guard', 'When a rule is relaxed', 'Natural-language interface', 'Owner-facing words', 'Repo hygiene', 'Commands', 'Token discipline'], formats: [WORK] },
  'ui-checker': { rules: ['Token discipline', 'Natural-language interface', 'Owner-facing words'], formats: [] },
  lead: { rules: ['Natural-language interface', 'Owner-facing words', 'Never guess', 'Language and nicknames', 'When the owner doubts a conclusion', 'Repo hygiene', 'Commands'], formats: [ASK] },
};

const GUIDES = ['skills/work-ticket/references/flow.md', 'skills/work-ticket/references/superpowers-bridge.md'];
const DEV_STEPS = ['design', 'plan', 'plan-check', 'implement'];

// The instructions for one step of the work-ticket flow, so the lead reads
// only the step it is on. Headings are "## <step>" or "## <step> — note".
export function stepGuide(pluginRoot, step) {
  const found = [];
  for (const rel of GUIDES) {
    const text = readFileSync(join(pluginRoot, rel), 'utf8');
    for (const part of text.split(/^(?=## )/m).filter((p) => p.startsWith('## '))) {
      const key = part.slice(3).split(/[\s(—]/)[0];
      if (key === step || (key === 'dev-rules' && DEV_STEPS.includes(step))) found.push(part.trimEnd());
    }
  }
  if (!found.length) throw new Error(`no guide for step "${step}"`);
  return found.join('\n\n');
}

export function agentBrief(pluginRoot, agent) {
  const spec = AGENT_SECTIONS[agent];
  if (!spec) throw new Error(`unknown agent "${agent}" (have: ${Object.keys(AGENT_SECTIONS).join(', ')})`);
  const parts = [`# Rules for ${agent}`, ruleSections(join(pluginRoot, 'shared', 'rules.md'), spec.rules)];
  if (spec.formats.length) parts.push('# Formats', ruleSections(join(pluginRoot, 'shared', 'formats.md'), spec.formats));
  return parts.join('\n\n');
}
