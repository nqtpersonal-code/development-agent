import { walkFiles, readText, rel, DEFAULT_IGNORE } from './files.mjs';

// Finds every line mentioning one of `terms`. With `contextTerms`, keeps only
// hits that have a context term within `contextWindow` lines, so common
// column names (name, status) do not flood the result.
export function searchCode({
  roots,
  terms,
  contextTerms = [],
  contextWindow = 40,
  ignore = DEFAULT_IGNORE,
  maxHits = 5000,
}) {
  const hits = [];
  let filesScanned = 0;
  let droppedNoContext = 0;
  let truncated = false;
  outer: for (const root of roots) {
    for (const abs of walkFiles(root, ignore)) {
      const text = readText(abs);
      if (text === null) continue;
      filesScanned++;
      if (!terms.some((t) => text.includes(t))) continue;
      const lines = text.split(/\r?\n/);
      const ctxLines = contextTerms.length
        ? lines.map((l, i) => (contextTerms.some((c) => l.includes(c)) ? i : -1)).filter((i) => i >= 0)
        : [];
      for (let i = 0; i < lines.length; i++) {
        const term = terms.find((t) => lines[i].includes(t));
        if (!term) continue;
        const context = contextTerms.length ? ctxLines.some((c) => Math.abs(c - i) <= contextWindow) : true;
        if (!context) {
          droppedNoContext++;
          continue;
        }
        if (hits.length >= maxHits) {
          truncated = true;
          break outer;
        }
        hits.push({ file: rel(root, abs), root, line: i + 1, text: lines[i].trim().slice(0, 240), term, context });
      }
    }
  }
  return { hits, truncated, filesScanned, droppedNoContext };
}
