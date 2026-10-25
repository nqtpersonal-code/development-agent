import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const STEPS = [
  'setup', 'analysis', 'screens', 'brief', 'test-design', 'free-qa', 'architect',
  'design', 'plan', 'plan-check', 'implement', 'review', 'qa', 'report', 'done',
];
const STATUSES = ['pending', 'running', 'waiting', 'done', 'skipped'];

const file = (workDir) => join(workDir, 'state.json');

export function newState(project, ticket) {
  return {
    project,
    ticket: String(ticket),
    current: 'setup',
    steps: Object.fromEntries(STEPS.map((s) => [s, 'pending'])),
    waitingFor: null,
    flags: { hasUI: null, architect: null },
    planCheckRounds: 0,
    files: {},
    updatedAt: new Date().toISOString(),
  };
}

export function readState(workDir) {
  const f = file(workDir);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    throw new Error(`cannot read ${f}: ${e.message}`);
  }
}

export function writeState(workDir, state) {
  mkdirSync(workDir, { recursive: true });
  const next = { ...state, updatedAt: new Date().toISOString() };
  const tmp = `${file(workDir)}.tmp`;
  writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf8');
  renameSync(tmp, file(workDir));
  return next;
}

function load(workDir) {
  const s = readState(workDir);
  if (!s) throw new Error(`no state.json in ${workDir}`);
  return s;
}

export function setStep(workDir, step, status, patch = {}) {
  if (!STEPS.includes(step)) throw new Error(`unknown step: ${step}`);
  if (!STATUSES.includes(status)) throw new Error(`unknown status: ${status}`);
  const s = load(workDir);
  s.steps[step] = status;
  Object.assign(s, patch);
  s.current = STEPS.find((x) => !['done', 'skipped'].includes(s.steps[x])) ?? 'done';
  return writeState(workDir, s);
}

export function setWaiting(workDir, waiting) {
  const s = load(workDir);
  s.waitingFor = waiting ? { ...waiting, since: new Date().toISOString() } : null;
  return writeState(workDir, s);
}
