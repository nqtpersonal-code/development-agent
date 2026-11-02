// Added lines that switch a check off instead of satisfying it: lint or type
// checks disabled, tests skipped, errors swallowed. Read from a unified diff.
export const SILENCERS = [
  [/eslint-disable|tslint:disable|prettier-ignore/, 'lint rule turned off'],
  [/@ts-(ignore|nocheck|expect-error)/, 'type check turned off'],
  [/\bas any\b|:\s*any\b|<any>/, 'type escape to any'],
  [/\b(it|test|describe)\.(skip|only|todo)\s*\(|\bx(it|describe|test)\s*\(/, 'test skipped or focused'],
  [/#pragma warning disable|\[Ignore\b|\[Fact\s*\(\s*Skip|\[Theory\s*\(\s*Skip|SuppressMessage/, '.NET warning or test disabled'],
  [/catch\s*(\([^)]*\))?\s*\{\s*\}/, 'error swallowed (empty catch)'],
  [/#\s*noqa|#\s*type:\s*ignore|@pytest\.mark\.skip/, 'Python check or test disabled'],
  [/--no-verify|HUSKY=0|SKIP_PREFLIGHT_CHECK/, 'git hooks or checks skipped'],
];

export function findSilenced(diff) {
  const out = [];
  let file = null;
  let line = 0;
  for (const raw of String(diff).split(/\r?\n/)) {
    if (raw.startsWith('+++ ')) {
      file = raw.slice(4).replace(/^b\//, '');
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
    if (hunk) {
      line = Number(hunk[1]);
      continue;
    }
    if (!file || file === '/dev/null') continue;
    if (raw.startsWith('+')) {
      const text = raw.slice(1);
      const hit = SILENCERS.find(([re]) => re.test(text));
      if (hit) out.push({ file, line, kind: hit[1], text: text.trim().slice(0, 120) });
      line++;
    } else if (!raw.startsWith('-')) line++;
  }
  return out;
}
