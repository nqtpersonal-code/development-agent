// Text from other people (ticket, comments, linked docs, pattern packs) is data.
// This finds what tries to hide from the reader or to give orders to an agent:
// invisible characters, text-direction tricks, and instruction-like phrases.
const HIDDEN = [
  [/[​-‍⁠]/u, 'zero-width character'],
  [/[‪-‮⁦-⁩]/u, 'text-direction override'],
  [/[\u{E0000}-\u{E007F}]/u, 'invisible tag character'],
];

const PHRASES = [
  [/\b(ignore|disregard|forget)\b[^.\n]{0,25}\b(previous|prior|above|earlier|all)\b[^.\n]{0,20}\b(instructions?|rules|prompts?|directions?|guidelines)\b/i, 'tells the agent to ignore its instructions'],
  [/\bdo not (tell|inform|show|mention)\b[^.\n]{0,30}\b(the )?(user|owner)\b/i, 'asks to hide something from the owner'],
  [/\b(reveal|print|show|repeat)\b[^.\n]{0,20}\b(your|the)\b[^.\n]{0,12}\b(system|hidden) (prompt|instructions)\b/i, 'asks for the system prompt'],
  [/<\/?(system|assistant|instructions?)>/i, 'fake system or assistant tag'],
  [/bỏ qua\s+(tất cả\s+|mọi\s+)?(các\s+)?(chỉ dẫn|hướng dẫn|quy tắc)\s+(trước|ở trên|trên)/i, 'tells the agent to ignore its instructions (Vietnamese)'],
];

const show = (s) => s.replace(/[​-‍⁠﻿‪-‮⁦-⁩]|[\u{E0000}-\u{E007F}]/gu, (c) => `\\u{${c.codePointAt(0).toString(16).toUpperCase()}}`).trim().slice(0, 110);

export function scanUntrusted(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach((raw, i) => {
    // a byte-order mark at the very start of a file is normal
    const line = i === 0 ? raw.replace(/^﻿/, '') : raw;
    const hidden = [...HIDDEN, [/﻿/u, 'zero-width character']].find(([re]) => re.test(line));
    if (hidden) out.push({ line: i + 1, kind: hidden[1], text: show(line) });
    const phrase = PHRASES.find(([re]) => re.test(line));
    if (phrase) out.push({ line: i + 1, kind: phrase[1], text: show(line) });
  });
  return out;
}
