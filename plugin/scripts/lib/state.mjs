import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const STEPS = [
  'setup', 'analysis', 'screens', 'risk', 'brief', 'test-design', 'free-qa', 'architect',
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

// Called when a run resumes: a clear-suggestion has done its job once the
// owner is back, so it is dropped; real questions/approvals stay pending.
export function resumeState(workDir) {
  const s = load(workDir);
  if (/^clear/.test(s.waitingFor?.kind ?? '')) {
    s.waitingFor = null;
    return writeState(workDir, s);
  }
  return s;
}

const FLAGS = ['hasUI', 'architect'];

export function setFlag(workDir, flag, value) {
  if (!FLAGS.includes(flag)) throw new Error(`unknown flag: ${flag}`);
  const s = load(workDir);
  s.flags[flag] = value === true || value === 'true' ? true : value === false || value === 'false' ? false : null;
  return writeState(workDir, s);
}

// waitingFor is only for the owner: a question, an approval, or the /clear reminder.
// Waiting for an agent is not recorded here.
const WAIT_KINDS = { question: 'question', approval: 'approval', 'clear-suggestion': 'clear-suggestion', clear: 'clear-suggestion' };

export function setWaiting(workDir, waiting) {
  if (waiting && !WAIT_KINDS[waiting.kind]) {
    throw new Error(`unknown waiting kind "${waiting.kind}": use question, approval or clear-suggestion (never for waiting on agents)`);
  }
  const s = load(workDir);
  s.waitingFor = waiting ? { ...waiting, kind: WAIT_KINDS[waiting.kind], since: new Date().toISOString() } : null;
  return writeState(workDir, s);
}
