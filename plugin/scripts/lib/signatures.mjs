// Function/method signature patterns for JS/TS and C#, shared by function
// extraction, enclosing-function lookup and caller tracing.
export const KEYWORDS = new Set(['if', 'for', 'foreach', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do',
  'try', 'with', 'using', 'lock', 'fixed', 'await', 'new', 'throw', 'yield', 'case', 'in', 'is', 'as', 'constructor']);

const CS_MODS = '(?:public|private|protected|internal|static|async|virtual|override|sealed|abstract|partial|new|extern|unsafe)';
const NOT_TYPE = '(?!class\\b|interface\\b|record\\b|struct\\b|enum\\b|namespace\\b|return\\b|await\\b|new\\b|throw\\b)';

export const SIGNATURES = [
  /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/,
  /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::\s*[^=]+)?=>|[A-Za-z_$][\w$]*\s*=>)/,
  // C# method: modifiers, return type (generics without parentheses), name, '('
  new RegExp(`^\\s*(?:\\[[^\\]]*\\]\\s*)*(?:${CS_MODS}\\s+)+${NOT_TYPE}[\\w.]+(?:<[^()]*>)?(?:\\[\\])?\\??\\s+([A-Za-z_]\\w*)\\s*(?:<[^>()]*>)?\\s*\\(`),
  // C# constructor
  /^\s*(?:public|private|protected|internal)\s+([A-Z]\w*)\s*\(/,
  // JS/TS class method (brace on the same line or the next one)
  /^\s*(?:public\s+|private\s+|protected\s+|static\s+|readonly\s+)*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\(.*\)\s*(?::\s*[^{=;]+)?\{?\s*$/,
];

export function signatureName(line) {
  for (const re of SIGNATURES) {
    const m = re.exec(line);
    if (m && !KEYWORDS.has(m[1])) return m[1];
  }
  return null;
}

// True when `line` declares `fn` (definition or interface member) rather than calling it.
export function declares(line, fn) {
  const name = fn.replace(/[$]/g, '\\$');
  if (new RegExp(`\\b(function|async)\\s+${name}\\s*\\(`).test(line)) return true;
  if (new RegExp(`\\b(?:const|let|var)\\s+${name}\\s*=`).test(line)) return true;
  if (new RegExp(`^\\s*(?:public\\s+|private\\s+|protected\\s+|static\\s+)*(?:async\\s+)?${name}\\s*\\(.*\\)\\s*(?::[^{]*)?\\{\\s*$`).test(line)) return true;
  if (new RegExp(`^\\s*(?:\\[[^\\]]*\\]\\s*)*(?:${CS_MODS}\\s+)*${NOT_TYPE}[\\w.]+(?:<[^()]*>)?(?:\\[\\])?\\??\\s+${name}\\s*(?:<[^>()]*>)?\\s*\\(`).test(line)) return true;
  return false;
}
