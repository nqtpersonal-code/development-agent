import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmp } from '../helpers/tmp.mjs';
import { STEPS, newState, readState, writeState, setStep, setWaiting } from '../../plugin/scripts/lib/state.mjs';

test('a new state starts at setup with every step pending', () => {
  const s = newState('demo', '12');
  assert.equal(s.current, 'setup');
  assert.deepEqual(Object.keys(s.steps), STEPS);
  assert.ok(Object.values(s.steps).every((v) => v === 'pending'));
});

test('readState returns null when no state exists', () => {
  assert.equal(readState(tmp()), null);
});

test('finishing a step moves current to the next open step, skipping skipped ones', () => {
  const d = tmp();
  writeState(d, newState('demo', '12'));
  setStep(d, 'setup', 'done');
  setStep(d, 'screens', 'skipped');
  const s = setStep(d, 'analysis', 'done');
  assert.equal(s.current, 'brief');
  assert.equal(readState(d).current, 'brief');
});

test('a pending owner question survives a reload (resume after /clear)', () => {
  const d = tmp();
  writeState(d, newState('demo', '12'));
  setWaiting(d, { kind: 'question', text: 'Học sinh nghỉ có phép có tính học phí không?' });
  const s = readState(d);
  assert.equal(s.waitingFor.kind, 'question');
  assert.match(s.waitingFor.text, /nghỉ có phép/);
  assert.ok(s.waitingFor.since);
  setWaiting(d, null);
  assert.equal(readState(d).waitingFor, null);
});

test('a corrupted state file raises an error naming the file', () => {
  const d = tmp();
  writeFileSync(join(d, 'state.json'), '{not json');
  assert.throws(() => readState(d), /state\.json/);
});

test('setStep rejects unknown steps and statuses', () => {
  const d = tmp();
  writeState(d, newState('demo', '12'));
  assert.throws(() => setStep(d, 'deploy', 'done'), /unknown step/);
  assert.throws(() => setStep(d, 'setup', 'finished'), /unknown status/);
});
