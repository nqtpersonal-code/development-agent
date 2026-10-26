import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreImpact } from '../../tools/eval-score.mjs';

const question = {
  id: 'X-Q1',
  expectedPlaces: [
    { file: 'api/src/students/students.service.ts' },
    { file: 'web/src/pages/AttendancePage.tsx' },
    { file: 'api/src/jobs/fee-reminder.job.ts' },
  ],
  mustNotInclude: [{ file: 'api/src/classes/teacher.ts' }],
  expectedProcedures: ['usp_StudentContacts'],
};

test('scoreImpact counts expected places by path or file name and lists the missing ones', () => {
  const text = 'Confirmed: [students.service.ts:26](api/src/students/students.service.ts#L26)\nAttendancePage.tsx shows the name\n';
  const s = scoreImpact(text, question);
  assert.equal(s.recall, 67);
  assert.deepEqual(s.found.map((f) => f.how), ['path', 'name']);
  assert.deepEqual(s.missing, ['api/src/jobs/fee-reminder.job.ts']);
  assert.deepEqual(s.procedures, [{ name: 'usp_StudentContacts', found: false }]);
});

test('scoreImpact flags a decoy named as affected, but not one that is ruled out', () => {
  assert.equal(scoreImpact('- teacher.ts is not affected: fullName belongs to teachers', question).falsePositives.length, 0);
  assert.equal(scoreImpact('- teacher.ts renders the full name (affected)', question).falsePositives.length, 1);
});
