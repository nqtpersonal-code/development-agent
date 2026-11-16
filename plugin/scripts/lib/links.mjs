import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join } from 'node:path';
import { walkFiles, rel } from './files.mjs';
import { listRepos } from './workspace.mjs';
import { CODE_EXT } from './plancheck.mjs';

// Evidence links are the owner's way to dig deeper ("[students.service.ts:26-27]
// (api/src/students/students.service.ts#L26-L27)"). An agent that invents or
// misplaces one gives false comfort, so each is checked against the real files:
// the file exists, the lines are inside it, and the label and the link agree.
const MD_LINK = /\[([^\]\n]*)\]\(<?([^)\s>]+)>?\)/g;
const BARE = new RegExp(`(?<![\\w/.-])((?:[\\w.-]+/)*[\\w-]+(?:\\.[\\w-]+)*\\.(?:${CODE_EXT})):(\\d+)(?:-(\\d+))?(?!\\d)`, 'g');
const LABEL_REF = /^`?([\w-]+(?:\.[\w-]+)*\.[A-Za-z]{1,6}):(\d+)(?:-(\d+))?`?$/;
const ANCHOR = /^L(\d+)(?:-L?(\d+))?$/;

const decode = (s) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

// Every reference in a markdown text: { line, path, start, end, label?, anchor? }.
export function extractRefs(text) {
  const refs = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    let rest = raw;
    for (const m of raw.matchAll(MD_LINK)) {
      rest = rest.replace(m[0], ' '.repeat(m[0].length));
      const href = m[2];
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(href) || /^mailto:/i.test(href)) continue;
      const [pathPart, hash = ''] = href.split('#');
      const anchor = ANCHOR.exec(hash);
      const label = LABEL_REF.exec(m[1].trim());
      if (!anchor && !label) continue; // a plain link (an image, another file), not a code citation
      const start = anchor ? Number(anchor[1]) : Number(label[2]);
      const end = anchor ? Number(anchor[2] ?? anchor[1]) : Number(label[3] ?? label[2]);
      refs.push({ line: i + 1, path: decode(pathPart), start, end, label: label ? { file: label[1], start: Number(label[2]), end: Number(label[3] ?? label[2]) } : null, linked: true });
    }
    for (const m of rest.matchAll(BARE)) {
      refs.push({ line: i + 1, path: m[1], start: Number(m[2]), end: Number(m[3] ?? m[2]), label: null, linked: false });
    }
  });
  return refs;
}

const lineCount = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);

// Checks the references of the given work files against the project folder.
// Returns problem strings ("impact.md:40 [students.service.ts:99] — the file has 52 lines").
export function checkLinks({ work, root, files }) {
  const repos = listRepos(root).map((r) => join(root, r.dir));
  let index = null; // basename -> paths, built only if a bare file name has to be looked up
  const sizes = new Map();
  const size = (p) => {
    if (!sizes.has(p)) sizes.set(p, lineCount(readFileSync(p, 'utf8')));
    return sizes.get(p);
  };
  const find = (p) => {
    const direct = isAbsolute(p) ? [p] : [join(root, p), ...repos.map((r) => join(r, p))];
    const hit = direct.filter((c) => existsSync(c) && statSync(c).isFile());
    if (hit.length) return hit;
    if (!index) {
      index = new Map();
      for (const f of walkFiles(root)) {
        const k = basename(f).toLowerCase();
        if (!index.has(k)) index.set(k, []);
        index.get(k).push(f);
      }
    }
    const byName = index.get(basename(p).toLowerCase()) ?? [];
    return p.includes('/') ? byName.filter((f) => rel(root, f).toLowerCase().endsWith(p.toLowerCase())) : byName;
  };

  const problems = [];
  const seen = new Set();
  for (const name of files) {
    const file = join(work, name);
    if (!existsSync(file)) continue;
    for (const r of extractRefs(readFileSync(file, 'utf8'))) {
      const key = `${name}|${r.path}|${r.start}|${r.end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const shown = `${basename(r.path)}:${r.start}${r.end !== r.start ? `-${r.end}` : ''}`;
      const where = `${name}:${r.line} [${shown}]`;
      if (r.end < r.start) {
        problems.push(`${where} — the line range runs backwards`);
        continue;
      }
      if (r.label && basename(r.path).toLowerCase() !== r.label.file.toLowerCase()) {
        problems.push(`${where} — the label names ${r.label.file} but the link points at ${basename(r.path)}`);
        continue;
      }
      if (r.linked && r.label && r.label.start !== r.start) {
        problems.push(`${where} — the label says line ${r.label.start} but the link points at line ${r.start}`);
        continue;
      }
      const found = find(r.path);
      if (!found.length) {
        problems.push(`${where} — no such file in the project`);
        continue;
      }
      if (!found.some((f) => size(f) >= r.end)) {
        problems.push(`${where} — the file has only ${Math.max(...found.map(size))} lines`);
      }
    }
  }
  return problems;
}
