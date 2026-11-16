import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// The owner's structure decisions (which pattern, or direct code, for what kind of
// change). The architect reads them first so an area already decided is not asked again.
const HEADER = `# Structure choices

One line per decision the owner made about the structure of new code. The architect reads this before asking.

`;

const clean = (s) => String(s).replace(/\s+/g, ' ').trim();

export function choicesFile(dataDir, project) {
  return join(dataDir, 'projects', project, 'structure-choices.md');
}

export function addChoice({ dataDir, project, ticket, area, choice, why, date = new Date().toISOString().slice(0, 10) }) {
  if (!clean(area) || !clean(choice)) throw new Error('structure-choice needs --area and --choice');
  const file = choicesFile(dataDir, project);
  mkdirSync(dirname(file), { recursive: true });
  if (!existsSync(file)) writeFileSync(file, HEADER, 'utf8');
  const line = `- ${date} · ticket ${clean(ticket)} · ${clean(area)} → ${clean(choice)}${why ? ` — ${clean(why)}` : ''}\n`;
  appendFileSync(file, line, 'utf8');
  return { file, line: line.trim() };
}
