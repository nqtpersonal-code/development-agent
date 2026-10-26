import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runtimeRequire } from './runtime.mjs';
import { getDataDir } from './config.mjs';

export const DEFAULT_VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

// Runs inside the page. Measures checklist items 1-4 (ui-defects.md).
function measure(isPhone) {
  const sel = (el) => {
    if (el.id) return `#${el.id}`;
    const cls = [...el.classList].slice(0, 2).map((c) => `.${c}`).join('');
    return `${el.tagName.toLowerCase()}${cls}`;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const issues = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > window.innerWidth + 1) {
    issues.push({ type: 'horizontal-overflow', selector: 'html', detail: `page is ${doc.scrollWidth}px wide in a ${window.innerWidth}px window` });
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el) || !el.textContent.trim() || el.children.length) continue;
    const s = getComputedStyle(el);
    const hides = ['hidden', 'clip'].includes(s.overflowX) || s.textOverflow === 'ellipsis';
    if (hides && el.scrollWidth > el.clientWidth + 1) {
      issues.push({ type: 'text-clipped', selector: sel(el), detail: `"${el.textContent.trim().slice(0, 40)}" needs ${el.scrollWidth}px, has ${el.clientWidth}px` });
    }
  }
  if (isPhone) {
    for (const el of document.querySelectorAll('a, button, input, select, textarea, [role="button"]')) {
      if (!visible(el) || el.type === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (Math.min(r.width, r.height) < 40) {
        issues.push({ type: 'small-tap-target', selector: sel(el), detail: `${Math.round(r.width)}x${Math.round(r.height)}px` });
      }
    }
  }
  for (const el of document.querySelectorAll('input, select, textarea')) {
    if (!visible(el) || el.type === 'hidden') continue;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) continue;
    const top = document.elementFromPoint(cx, cy);
    if (top && top !== el && !el.contains(top) && !top.contains(el) && top.tagName !== 'LABEL') {
      issues.push({ type: 'covered-input', selector: sel(el), detail: `covered by ${sel(top)}` });
    }
  }
  return issues;
}

export async function uiCheck({ url, outDir, viewports = DEFAULT_VIEWPORTS, login, waitFor, dataDir = getDataDir() }) {
  const { chromium } = runtimeRequire(dataDir, 'playwright');
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const issues = [];
  const screenshots = [];
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    // Errors the screen hides from users: script errors and server calls that fail.
    const runtime = new Map();
    const note = (type, detail) => {
      if (!runtime.has(`${type}|${detail}`)) runtime.set(`${type}|${detail}`, { viewport: 'any', type, selector: '-', detail: detail.slice(0, 200) });
    };
    page.on('console', (m) => { if (m.type() === 'error') note('console-error', m.text()); });
    page.on('pageerror', (e) => note('page-error', e.message));
    page.on('response', (r) => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) note('failed-request', `${r.request().method()} ${r.url()} → ${r.status()}`); });
    page.on('requestfailed', (r) => note('failed-request', `${r.method()} ${r.url()} → ${r.failure()?.errorText ?? 'failed'}`));
    if (login) {
      await page.goto(login.url);
      for (const s of login.steps ?? []) {
        if (s.action === 'fill') await page.fill(s.selector, s.value ?? '');
        else if (s.action === 'click') await page.click(s.selector);
        else if (s.action === 'goto') await page.goto(s.value);
      }
    }
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(url, { waitUntil: 'load' });
      // Apps that poll never reach network idle; wait briefly, then measure anyway.
      await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      if (waitFor) await page.waitForSelector(waitFor, { timeout: 10000 });
      const found = await page.evaluate(measure, vp.width < 600);
      for (const i of found) issues.push({ viewport: vp.name, ...i });
      const shot = join(outDir, `${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      screenshots.push(shot);
    }
    issues.unshift(...runtime.values());
  } finally {
    await browser.close();
  }
  const report = { url, issues, screenshots };
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  return report;
}

export function summarizeUi(report) {
  if (!report.issues.length) return [`ui-check ${report.url}: no measurable defects (screenshots: ${report.screenshots.length})`];
  const lines = [`ui-check ${report.url}: ${report.issues.length} issue(s)`];
  for (const i of report.issues.slice(0, 8)) lines.push(`  [${i.viewport}] ${i.type} ${i.selector} — ${i.detail}`);
  if (report.issues.length > 8) lines.push(`  … ${report.issues.length - 8} more in report.json`);
  return lines;
}
