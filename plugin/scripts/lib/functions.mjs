import { walkFiles, readText, rel } from './files.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'try', 'with', 'constructor']);

const START = [
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::\s*[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/,
  /^\s*(?:public\s+|private\s+|protected\s+|static\s+)*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*(?::\s*[^{]+)?\{\s*$/,
];
const ROUTE_START = /\b(?:router|app)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/;

// Function-level units with 1-based inclusive line ranges, found by regex and
// brace counting (strings containing braces can skew ranges; good enough to
// compare units, not to parse code).
export function extractFunctions(roots) {
  const out = [];
  for (const root of roots) {
    for (const abs of walkFiles(root)) {
      if (!CODE.test(abs)) continue;
      const text = readText(abs) ?? '';
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        let name = null;
        const r = ROUTE_START.exec(lines[i]);
        if (r) name = `${r[1].toUpperCase()} ${r[2]}`;
        else {
          for (const re of START) {
            const m = re.exec(lines[i]);
            if (m && !KEYWORDS.has(m[1])) {
              name = m[1];
              break;
            }
          }
        }
        if (!name) continue;
        let depth = 0;
        let opened = false;
        let end = i;
        for (let j = i; j < lines.length; j++) {
          for (const ch of lines[j]) {
            if (ch === '{') {
              depth++;
              opened = true;
            } else if (ch === '}') depth--;
          }
          end = j;
          if (opened && depth <= 0) break;
        }
        if (!opened) continue;
        out.push({ root, file: rel(root, abs), name, start: i + 1, end: end + 1, text: lines.slice(i, end + 1).join('\n') });
      }
    }
  }
  return out;
}
