import { readFileSync } from 'node:fs';

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
