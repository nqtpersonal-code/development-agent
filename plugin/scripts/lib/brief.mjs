// Owner answers go straight into ticket-brief.md, so the lead records them
// without reading the brief back into its context.
const SECTIONS = ['Summary', 'Requirements', 'Acceptance criteria', 'Screens', 'Impact summary', 'Change points', 'Fix mode', 'Owner answers', 'Open questions'];

export function briefSkeleton() {
  return `# Ticket brief\n\n${SECTIONS.map((s, i) => `## ${i + 1}. ${s}\n`).join('\n')}`;
}

// "Q1: answer" or "Q1 → answer", one per line; other lines are ignored.
export function parseAnswers(text) {
  return text.split(/\r?\n/)
    .map((l) => /^\s*-?\s*(Q\d+)\s*(?::|→|->)\s*(.+?)\s*$/.exec(l))
    .filter(Boolean)
    .map((m) => ({ q: m[1], a: m[2] }));
}

export function addOwnerAnswers(text, answers, date) {
  const lines = answers.map(({ q, a }) => `- ${q} → ${a} (${date})`).join('\n');
  const head = /^##[^\n]*Owner answers[^\n]*\n/im.exec(text);
  if (!head) return `${text.trimEnd()}\n\n## Owner answers\n\n${lines}\n`;
  const start = head.index + head[0].length;
  const next = text.slice(start).search(/^## /m);
  const end = next === -1 ? text.length : start + next;
  const body = text.slice(start, end).trimEnd();
  return `${text.slice(0, start)}${body || '\n'}${body ? '\n' : ''}${lines}\n${next === -1 ? '' : '\n'}${text.slice(end)}`;
}
