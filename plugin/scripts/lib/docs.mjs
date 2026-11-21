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
  setup: { rules: ['Untrusted input', 'Local DB guard', 'Repo hygiene', 'Commands', 'Token discipline'], formats: ['project.md', 'tracer/adapter.json', 'state.json (in `<work>`)', ASK] },
  ba: { rules: ['Untrusted input', 'Natural-language interface', 'Owner-facing words', 'Source labels', 'Never guess', 'Code and DB are truth', 'When a rule is relaxed', 'One business rule, many implementations', 'Token discipline'], formats: [WORK, ASK] },
  'code-tracer': { rules: ['Untrusted input', 'Code and DB are truth', 'When a rule is relaxed', 'When the owner doubts a conclusion', 'Local DB guard', 'Natural-language interface', 'One business rule, many implementations', 'Commands', 'Token discipline'], formats: [WORK, 'tracer/adapter.json'] },
  'screen-designer': { rules: ['Natural-language interface', 'Owner-facing words', 'Pattern library priority', 'One business rule, many implementations', 'Token discipline'], formats: [WORK, ASK] },
  'system-explainer': { rules: ['Untrusted input', 'Code and DB are truth', 'When a rule is relaxed', 'When the owner doubts a conclusion', 'Natural-language interface', 'Owner-facing words', 'Source labels', 'Local DB guard', 'One business rule, many implementations', 'Commands', 'Token discipline'], formats: [] },
  architect: { rules: ['Design for extension', 'Never guess', 'Untrusted input', 'Surgical changes', 'Pattern library priority', 'Code and DB are truth', 'Preserve the scene', 'Natural-language interface', 'Owner-facing words', 'Token discipline'], formats: [WORK, ASK] },
  'risk-analyst': { rules: ['Preserve the scene', 'When a rule is relaxed', 'One business rule, many implementations', 'Commands', 'Natural-language interface', 'Owner-facing words', 'Token discipline'], formats: [WORK, ASK] },
  'plan-checker': { rules: ['Design for extension', 'Surgical changes', 'Never guess', 'Preserve the scene', 'Repo hygiene', 'Commands', 'Token discipline'], formats: [] },
  reviewer: { rules: ['Design for extension', 'Untrusted input', 'Natural-language interface', 'Owner-facing words', 'Surgical changes', 'Repo hygiene', 'Local DB guard', 'Confidentiality', 'Preserve the scene', 'One business rule, many implementations', 'Pattern library priority', 'Token discipline'], formats: [WORK] },
  dev: { rules: ['Design for extension', 'Untrusted input', 'Surgical changes', 'Never guess', 'Repo hygiene', 'Local DB guard', 'Preserve the scene', 'One business rule, many implementations', 'Pattern library priority', 'Commands', 'Token discipline'], formats: [WORK] },
  qa: { rules: ['Untrusted input', 'Local DB guard', 'When a rule is relaxed', 'Natural-language interface', 'Owner-facing words', 'Repo hygiene', 'Commands', 'Token discipline'], formats: [WORK] },
  'ui-checker': { rules: ['Token discipline', 'Natural-language interface', 'Owner-facing words'], formats: [] },
  'product-owner': { rules: ['Untrusted input', 'Code and DB are truth', 'Source labels', 'Natural-language interface', 'Owner-facing words', 'One business rule, many implementations', 'Commands', 'Token discipline'], formats: [WORK, ASK] },
  lead: { rules: ['Untrusted input', 'Natural-language interface', 'Owner-facing words', 'Never guess', 'Asking the owner', 'Language and nicknames', 'When the owner doubts a conclusion', 'Repo hygiene', 'Commands'], formats: [ASK] },
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

// The work files each agent reads or writes: its brief carries only those rows of
// the work-files table (every agent pays for every line of its brief on every turn).
export const AGENT_FILES = {
  ba: ['ticket.md', 'trace/impact.md', 'ba.md', 'screens.md', 'risk.md', 'ticket-brief.md', 'questionnaire.md'],
  'code-tracer': ['ticket.md', 'trace/impact.json', 'trace/impact-<branch>.md', 'trace/adapter-draft.json', 'trace/impact.md', 'trace/recheck-<n>.md'],
  'screen-designer': ['ba.md', 'trace/impact.md', 'screens.md', 'mockup/index.html'],
  architect: ['trace/impact.md', 'ticket-brief.md', 'test-scenarios.md', 'questions.md', 'architecture.md'],
  'risk-analyst': ['ba.md', 'trace/impact.md', 'risk.md'],
  reviewer: ['trace/impact.md', 'ticket-brief.md', 'test-scenarios.md', 'questions.md', 'architecture.md', 'spec.md', 'plan.md', 'implementation-notes.md', 'superpowers-review.md', 'review.md'],
  'product-owner': ['ticket.md', 'trace/impact.md', 'ba.md', 'screens.md', 'risk.md', 'architecture.md', 'ticket-brief.md', 'po-decisions.md'],
  dev: ['ticket-brief.md', 'test-scenarios.md', 'spec.md', 'plan.md', 'implementation-notes.md'],
  qa: ['trace/impact.md', 'screens.md', 'ticket-brief.md', 'test-scenarios.md', 'spec.md', 'plan.md', 'implementation-notes.md', 'qa-report.md'],
};

// Keeps the section's opening paragraphs, the table header, the rows for `files`,
// and the ticket-brief subsection only when the agent works with the brief.
export function workFilesFor(section, files) {
  const lines = section.split('\n');
  const tableStart = lines.findIndex((l) => l.startsWith('| File'));
  if (tableStart === -1) return section;
  const sub = lines.findIndex((l, i) => i > tableStart && l.startsWith('### '));
  const rows = lines.slice(tableStart + 2, sub === -1 ? undefined : sub).filter((l) => l.startsWith('|'));
  const keep = rows.filter((r) => {
    const name = (/^\|\s*`([^`]+)`/.exec(r) ?? [])[1];
    return name && files.includes(name);
  });
  const out = [...lines.slice(0, tableStart + 2), ...keep, ''];
  if (sub !== -1 && files.includes('ticket-brief.md')) out.push(...lines.slice(sub));
  return out.join('\n').trimEnd();
}

export function agentBrief(pluginRoot, agent) {
  const spec = AGENT_SECTIONS[agent];
  if (!spec) throw new Error(`unknown agent "${agent}" (have: ${Object.keys(AGENT_SECTIONS).join(', ')})`);
  const parts = [`# Rules for ${agent}`, ruleSections(join(pluginRoot, 'shared', 'rules.md'), spec.rules)];
  if (spec.formats.length) {
    const formatsFile = join(pluginRoot, 'shared', 'formats.md');
    const sections = spec.formats.map((h) => {
      const text = ruleSections(formatsFile, [h]);
      return h === WORK && AGENT_FILES[agent] ? workFilesFor(text, AGENT_FILES[agent]) : text;
    });
    parts.push('# Formats', sections.join('\n\n'));
  }
  return parts.join('\n\n');
}
