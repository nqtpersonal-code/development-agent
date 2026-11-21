import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { STEPS, readState } from './state.mjs';

// Autopilot runner: one fresh headless Claude Code session per leg of the ticket
// (a leg ends at a /clear boundary), so no session drags the whole ticket's context.
// After each session it reads the ticket's state and stops when the ticket is done,
// waits for the owner (a red line), passes the cost cap, makes no progress, or fails.

const ALLOWED = 'Agent Skill Bash PowerShell Read Write Edit Glob Grep TodoWrite';
// The runner never lets its sessions push or publish, whatever a prompt says.
const DISALLOWED = ['Bash(git push:*)', 'PowerShell(git push:*)', 'Bash(gh pr create:*)', 'PowerShell(gh pr create:*)', 'Bash(glab mr create:*)', 'PowerShell(glab mr create:*)'];

const doneCount = (s) => STEPS.filter((x) => ['done', 'skipped'].includes(s.steps?.[x])).length;

export function sessionPrompt({ ticket, project }) {
  return [
    `Invoke the Skill tool with skill "nqt:work-ticket" and args "${project ? `${project} ` : ''}${ticket} --auto", then follow it.`,
    'This is an unattended autopilot session: nobody will answer here. The product-owner agent answers for the owner;',
    'a red line is recorded as a waiting question and ends the session. At a /clear boundary, end the session:',
    'the runner starts a fresh one. Never push, open a pull or merge request, or merge.',
  ].join('\n');
}

// A headless session may only edit files under its own folder unless told otherwise; the
// ticket's work files live in the nqt data folder, so that folder is added (`--add-dir`)
// and file edits there are accepted without a prompt nobody would answer.
export function claudeCommand({ claude = 'claude', model, addDirs = [] } = {}) {
  return [claude, '-p', '--output-format', 'json', ...(model ? ['--model', model] : []),
    '--permission-mode', 'acceptEdits', ...addDirs.flatMap((d) => ['--add-dir', `"${d}"`]),
    '--allowedTools', `"${ALLOWED}"`, '--disallowedTools', ...DISALLOWED.map((d) => `"${d}"`)].join(' ');
}

export function runAutopilot({ root, work, ticket, project, dataDir, maxCostUsd = 10, maxSessions = 12, model, claude = process.env.NQT_CLAUDE_CMD || 'claude', onSession = () => {} }) {
  mkdirSync(work, { recursive: true });
  const logFile = join(work, 'autopilot.log');
  const log = (line) => appendFileSync(logFile, `${new Date().toISOString()} ${line}\n`, 'utf8');
  log(`start: ticket ${ticket}, cost cap $${maxCostUsd}, at most ${maxSessions} sessions`);
  let cost = 0;
  let stalled = 0;
  let before = readState(work);
  for (let i = 1; i <= maxSessions; i++) {
    const r = spawnSync(claudeCommand({ claude, model, addDirs: [dataDir ?? join(work, '..', '..', '..')] }), {
      shell: true, cwd: root, input: sessionPrompt({ ticket, project }), encoding: 'utf8', maxBuffer: 1 << 26,
      timeout: 2 * 60 * 60 * 1000, env: { ...process.env, NQT_AUTOPILOT: '1' },
    });
    let meta = {};
    try {
      meta = JSON.parse(r.stdout);
    } catch {
      meta = { is_error: true, result: (r.stderr || r.stdout || `exit ${r.status}`).slice(0, 300) };
    }
    cost += Number(meta.total_cost_usd) || 0;
    const s = readState(work);
    const line = `session ${i}: step ${s?.current ?? '?'} (${s ? doneCount(s) : 0}/${STEPS.length} done), cost so far $${cost.toFixed(2)}`;
    log(line);
    // The session's own last words say why it ended; without them a stuck run cannot be read.
    if (meta.result) log(`  said: ${String(meta.result).replace(/\s+/g, ' ').slice(0, 600)}`);
    onSession(line);
    const stop = (reason, detail) => {
      log(`stop: ${reason}${detail ? ` — ${detail}` : ''}`);
      return { reason, detail, sessions: i, cost, step: s?.current ?? null };
    };
    if (meta.is_error) return stop('error', String(meta.result ?? '').slice(0, 300));
    if (!s) return stop('error', 'the session did not create the ticket state');
    if (s.current === 'done' || s.steps?.report === 'done') return stop('finished');
    if (s.waitingFor && ['question', 'approval'].includes(s.waitingFor.kind)) return stop('needs-owner', s.waitingFor.text);
    if (cost >= maxCostUsd) return stop('cost-cap', `$${cost.toFixed(2)} of $${maxCostUsd}`);
    const progressed = !before || s.current !== before.current || doneCount(s) !== doneCount(before);
    stalled = progressed ? 0 : stalled + 1;
    if (stalled >= 2) return stop('stuck', `no step finished in the last two sessions (at ${s.current})`);
    before = s;
  }
  log(`stop: too-many-sessions`);
  const s = readState(work);
  return { reason: 'too-many-sessions', sessions: maxSessions, cost, step: s?.current ?? null };
}

export function lastLog(work, n = 6) {
  const f = join(work, 'autopilot.log');
  return existsSync(f) ? readFileSync(f, 'utf8').trimEnd().split('\n').slice(-n) : [];
}
