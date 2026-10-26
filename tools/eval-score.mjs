// Scores a code-tracer impact.md against an answer key question
// (tests/fixtures/answers/*.json): which expected places it names, which
// decoys it wrongly names as affected, which DB procedures it found.
const norm = (s) => String(s).replace(/\\/g, '/').toLowerCase();
const base = (p) => norm(p).split('/').pop();
const NEGATED = /\b(not|no|n't|unaffected|unrelated|decoy|excluded|ignored|ruled out|false positive|belongs to|(?:an)?other table|different table)\b|không|loại trừ/i;

export function scoreImpact(text, question) {
  const doc = norm(text);
  const lines = doc.split('\n');
  // A Razor page is a view plus its code-behind (X.cshtml + X.cshtml.cs): naming either names the page.
  const page = (p) => norm(p).replace(/\.cshtml\.cs$/, '.cshtml');
  const mention = (file) => (doc.includes(page(file)) ? 'path' : doc.includes(base(page(file))) ? 'name' : null);
  const found = [];
  const missing = [];
  for (const p of question.expectedPlaces ?? []) {
    const how = mention(p.file);
    if (how) found.push({ file: p.file, how });
    else missing.push(p.file);
  }
  const falsePositives = [];
  for (const d of question.mustNotInclude ?? []) {
    const hits = lines.filter((l) => l.includes(base(d.file)));
    const affirmative = hits.filter((l) => !NEGATED.test(l));
    if (affirmative.length) falsePositives.push({ file: d.file, line: affirmative[0].trim().slice(0, 160) });
  }
  const procedures = (question.expectedProcedures ?? []).map((name) => ({ name, found: doc.includes(norm(name)) }));
  const expected = (question.expectedPlaces ?? []).length;
  return {
    id: question.id,
    recall: expected ? Math.round((found.length / expected) * 100) : 100,
    found,
    missing,
    falsePositives,
    procedures,
  };
}
