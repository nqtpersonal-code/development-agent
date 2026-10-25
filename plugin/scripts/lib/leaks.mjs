import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseFrontmatter } from './frontmatter.mjs';

const URL_ALLOW = [
  'localhost', '127.0.0.1', 'example.com', 'example.org', 'github.com/anthropics', 'github.com/obra',
  'registry.npmjs.org', 'www.npmjs.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com',
  'claude.ai', 'claude.com', 'anthropic.com', 'docs.anthropic.com', 'playwright.dev', 'nodejs.org',
  'mermaid.js.org', 'schema.org', 'www.w3.org', 'json-schema.org', 'semver.org',
];
const EMAIL_ALLOW = ['noreply@anthropic.com'];
const TICKET_IGNORE = new Set(['UTF', 'SHA', 'ISO', 'ES', 'WCAG', 'RFC', 'HTTP', 'TLS', 'SSL', 'IPV', 'ECMA', 'CVE']);

const TICKET_RE = /(?:^|[^\w#&])(#\d{2,})\b|\b([A-Z]{2,10})-(\d+)\b/g;
const URL_RE = /https?:\/\/([^\s)"'`<>\]]+)/g;
const EMAIL_RE = /[\w.+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b/gi;
const SECRET_RES = [
  /-----BEGIN [A-Z ]*(?:PRIVATE KEY|CERTIFICATE)-----/,
  /\b(?:api[_-]?key|secret|token|password|passwd|pwd)\b["']?\s*[:=]\s*(?!process\.env|\$\{|<|["']?\$)["']?[^\s"']{8,}/i,
  /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|mssql|sqlserver):\/\/([^:@\s/]+):([^@\s/]+)@/i,
];

export function normalizeName(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Multi-word names (or long single words) are also matched with spaces
// removed, so "TruongABC" and "truongabc.vn" are caught for "truong-abc".
const squashable = (n) => n.includes(' ') ? n.replace(/ /g, '').length >= 5 : n.length >= 8;

const isFixture = (path) => /(^|[\\/])tests[\\/]fixtures[\\/]/.test(path);

export function scanLeaks({ files, projectNames = [], extraTerms = [] }) {
  const names = [...projectNames, ...extraTerms].map(normalizeName).filter((n) => n.length >= 3);
  const findings = [];
  for (const { path, content } of files) {
    const fixture = isFixture(path);
    const text = String(content);
    // Scanner test files deliberately contain fake leaks; they may opt out of
    // the pattern rules, but project names are always checked.
    const ignorePatterns = /^.{0,10}nqt-leak-scan: ignore-file/.test(text);
    text.split(/\r?\n/).forEach((line, idx) => {
      const add = (kind, match) => findings.push({ path, line: idx + 1, kind, match });
      const norm = ` ${normalizeName(line)} `;
      const squashed = norm.replace(/ /g, '');
      for (const n of names) {
        if (norm.includes(` ${n} `) || (squashable(n) && squashed.includes(n.replace(/ /g, '')))) add('project-name', n);
      }
      if (ignorePatterns) return;
      if (!fixture) {
        for (const m of line.matchAll(TICKET_RE)) {
          if (m[1]) add('ticket-id', m[1]);
          else if (!TICKET_IGNORE.has(m[2])) add('ticket-id', `${m[2]}-${m[3]}`);
        }
      }
      for (const m of line.matchAll(URL_RE)) {
        const host = m[1].toLowerCase();
        const template = host.startsWith('${');
        const example = /^(?:[\w-]+\.)*example\.(?:com|org|net)(?:[/:]|$)/.test(host);
        if (!template && !example && !URL_ALLOW.some((a) => host === a || host.startsWith(`${a}/`) || host.startsWith(`${a}:`))) add('url', m[0]);
      }
      for (const m of line.matchAll(EMAIL_RE)) {
        const exampleDomain = /@(?:[\w-]+\.)*example\.(?:com|org|net)$/i.test(m[0]);
        if (!EMAIL_ALLOW.includes(m[0].toLowerCase()) && !exampleDomain && !m[0].includes('://')) add('email', m[0]);
      }
      for (const re of SECRET_RES) {
        const m = re.exec(line);
        if (!m) continue;
        const fictionalFixtureDb = fixture && m[1] && m[1] === 'school' && m[2] === 'school';
        if (!fictionalFixtureDb) add('secret', m[0].slice(0, 40));
      }
    });
  }
  return findings;
}

export function projectNamesFrom(dataDir) {
  const dir = join(dataDir, 'projects');
  if (!existsSync(dir)) return [];
  const names = new Set();
  for (const p of readdirSync(dir)) {
    if (!statSync(join(dir, p)).isDirectory()) continue;
    names.add(p);
    const f = join(dir, p, 'project.md');
    if (!existsSync(f)) continue;
    const fm = parseFrontmatter(readFileSync(f, 'utf8'));
    if (typeof fm.name === 'string' && fm.name) names.add(fm.name);
    for (const a of [].concat(fm.aliases ?? [])) if (a) names.add(String(a));
  }
  return [...names];
}
