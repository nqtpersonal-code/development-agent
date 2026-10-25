// Spellings a DB/code name can take across layers: full_name, fullName,
// FullName, full-name, FULL_NAME; table names also in singular form.
export function splitWords(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);

export function singular(word) {
  if (/ies$/.test(word)) return word.slice(0, -3) + 'y';
  if (/(ss|sh|ch|x|z)es$/.test(word)) return word.slice(0, -2);
  if (/s$/.test(word) && !/ss$/.test(word)) return word.slice(0, -1);
  return word;
}

function spellings(words) {
  if (!words.length) return [];
  const [first, ...rest] = words;
  return [
    words.join('_'),
    first + rest.map(cap).join(''),
    words.map(cap).join(''),
    words.join('-'),
    words.join('_').toUpperCase(),
  ];
}

export function nameVariants(name) {
  const words = splitWords(name);
  const out = spellings(words);
  const last = words.at(-1);
  const sing = last ? singular(last) : last;
  if (sing && sing !== last) out.push(...spellings([...words.slice(0, -1), sing]));
  return [...new Set(out)];
}
