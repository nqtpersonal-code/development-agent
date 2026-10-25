// Minimal frontmatter parser: flat `key: value`, nested maps by indentation,
// `- item` lists and inline `[a, b]` lists. Enough for nqt config files; no deps.
export function parseFrontmatter(text) {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return m ? parseBlock(m[1].split(/\r?\n/)) : {};
}

function parseBlock(lines) {
  const root = {};
  const stack = [{ indent: -1, holder: null, key: null, obj: root }];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
    const frame = stack.at(-1);
    if (line.startsWith('- ')) {
      if (!frame.holder) continue;
      if (!Array.isArray(frame.holder[frame.key])) frame.holder[frame.key] = [];
      frame.holder[frame.key].push(scalar(line.slice(2)));
      continue;
    }
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    const rest = line.slice(i + 1).trim();
    const target = Array.isArray(frame.obj) ? null : frame.obj;
    if (!target) continue;
    if (rest === '') {
      target[key] = {};
      stack.push({ indent, holder: target, key, obj: target[key] });
    } else {
      target[key] = scalar(rest);
    }
  }
  return root;
}

function scalar(v) {
  const s = v.replace(/\s+#.*$/, '').trim();
  if (/^".*"$|^'.*'$/.test(s)) return s.slice(1, -1);
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^\[.*\]$/.test(s)) return s.slice(1, -1).split(',').map((x) => scalar(x)).filter((x) => x !== '');
  return s;
}
