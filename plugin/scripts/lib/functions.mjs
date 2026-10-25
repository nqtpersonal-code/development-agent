import { walkFiles, readText, rel } from './files.mjs';
import { signatureName } from './signatures.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs|cs)$/;
const ROUTE_START = /\b(?:router|app)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/;
const CS_MAP_START = /\.Map(Get|Post|Put|Patch|Delete)\(\s*"([^"]*)"/;

// Function-level units with 1-based inclusive line ranges, found by regex and
// brace counting (strings containing braces can skew ranges; good enough to
// compare units, not to parse code). Handles JS/TS and C# (Allman braces,
// expression-bodied members).
export function extractFunctions(roots) {
  const out = [];
  for (const root of roots) {
    for (const abs of walkFiles(root)) {
      if (!CODE.test(abs)) continue;
      const lines = (readText(abs) ?? '').split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const r = ROUTE_START.exec(line) ?? CS_MAP_START.exec(line);
        const name = r ? `${r[1].toUpperCase()} ${r[2]}` : signatureName(line);
        if (!name) continue;
        const beforeSemicolon = line.split(';')[0];
        if (!r && !beforeSemicolon.includes('{') && /=>/.test(beforeSemicolon) && /;\s*$/.test(line)) {
          out.push({ root, file: rel(root, abs), name, start: i + 1, end: i + 1, text: line });
          continue;
        }
        if (!r && /\)\s*;\s*$/.test(line) && !line.includes('{')) continue; // declaration without body
        let depth = 0;
        let opened = false;
        let end = i;
        for (let j = i; j < lines.length && j < i + 2000; j++) {
          for (const ch of lines[j]) {
            if (ch === '{') {
              depth++;
              opened = true;
            } else if (ch === '}') depth--;
          }
          end = j;
          if (opened && depth <= 0) break;
          if (!opened && j > i + 1) break; // no body within the next line: not a function
        }
        if (!opened) continue;
        out.push({ root, file: rel(root, abs), name, start: i + 1, end: end + 1, text: lines.slice(i, end + 1).join('\n') });
      }
    }
  }
  return out;
}
