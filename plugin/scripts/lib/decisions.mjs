import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PO_TAG } from './brief.mjs';

// The owner's own past decisions in this project: the Owner answers of every
// ticket brief, and the structure choices. The product-owner agent answers from
// these first. Answers the product-owner agent gave itself are left out, so its
// own guesses never become precedent.
function ownerAnswers(text) {
  const head = /^##[^\n]*Owner answers[^\n]*\n/im.exec(text);
  if (!head) return [];
  const rest = text.slice(head.index + head[0].length);
  const end = rest.search(/^## /m);
  return (end === -1 ? rest : rest.slice(0, end)).split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^-\s*\S/.test(l) && !l.includes(PO_TAG))
    .map((l) => l.replace(/^-\s*/, ''));
}

export function pastDecisions({ dataDir, project, exceptTicket }) {
  const out = [];
  const work = join(dataDir, 'work', project);
  if (existsSync(work)) {
    for (const ticket of readdirSync(work).sort()) {
      if (ticket.startsWith('_') || String(ticket) === String(exceptTicket)) continue;
      const brief = join(work, ticket, 'ticket-brief.md');
      if (!statSync(join(work, ticket)).isDirectory() || !existsSync(brief)) continue;
      const title = (/^#\s+(.+)$/m.exec(readFileSync(brief, 'utf8')) ?? [])[1] ?? '';
      for (const a of ownerAnswers(readFileSync(brief, 'utf8'))) out.push({ ticket, title: title.slice(0, 80), answer: a });
    }
  }
  const choices = join(dataDir, 'projects', project, 'structure-choices.md');
  const structure = existsSync(choices) ? readFileSync(choices, 'utf8').split(/\r?\n/).filter((l) => /^-\s/.test(l)).map((l) => l.slice(2).trim()) : [];
  return { answers: out, structure };
}

export function formatDecisions({ answers, structure }) {
  const lines = ['# Past decisions of the owner', ''];
  if (!answers.length && !structure.length) return `${lines.join('\n')}none yet\n`;
  let current = null;
  for (const a of answers) {
    if (a.ticket !== current) {
      lines.push('', `## Ticket ${a.ticket}${a.title ? ` — ${a.title}` : ''}`);
      current = a.ticket;
    }
    lines.push(`- ${a.answer}`);
  }
  if (structure.length) lines.push('', '## Structure choices', ...structure.map((s) => `- ${s}`));
  return `${lines.join('\n')}\n`;
}
