import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getPreviewWorkspace } from '../src/lib/repository.ts';
import { formatRecordDate, getKidneySeries, searchRecords } from '../src/lib/domain.ts';

test('the index-patient preview excludes both relatives and their source records', () => {
  const view = getPreviewWorkspace('patient');
  assert.equal(view.records.length, 11);
  assert.equal(view.patient.name, 'Aarav Sen');
  assert.ok(view.records.every((r) => !['R12', 'R13'].includes(r.alias)));
  assert.ok(view.family.every((f) => !Object.hasOwn(f, 'relativePatientId')));
  assert.equal(JSON.stringify(view).includes('relative_reported'), false);
});

test('professional/operations previews receive no clinical or family payload', () => {
  for (const role of ['doctor', 'facility', 'platform']) {
    const view = getPreviewWorkspace(role);
    assert.equal(view.patient, null);
    assert.deepEqual(view.records, []);
    assert.deepEqual(view.family, []);
    assert.equal(JSON.stringify(view).includes('creatinine'), false);
    assert.equal(JSON.stringify(view).includes('breast_cancer'), false);
  }
});

test('facility operations are restricted to their fixture organization', () => {
  assert.deepEqual(
    getPreviewWorkspace('facility').facilities.map((f) => f.name),
    ['Aster Grove Demo Hospital'],
  );
  assert.equal(getPreviewWorkspace('platform').facilities.length, 3);
});

test('the four source measurements preserve exact dates, values and ownership projection', () => {
  const points = getKidneySeries(getPreviewWorkspace('patient').records);
  assert.deepEqual(
    points.map((p) => p.date),
    ['2026-01-06', '2026-03-17', '2026-06-19', '2026-09-09'],
  );
  assert.deepEqual(
    points.map((p) => p.creatinine),
    [0.9, 1.1, 1.4, 1.6],
  );
  assert.deepEqual(
    points.map((p) => p.egfr),
    [104, 88, 66, 57],
  );
  assert.equal(new Set(points.map((p) => p.facility)).size, 3);
});

test('a historical year stays year-only instead of inventing a clinical date', () => {
  const childhood = getPreviewWorkspace('patient').records.find((r) => r.alias === 'R11');
  assert.equal(childhood.clinicalDate, null);
  assert.equal(formatRecordDate(childhood), '1994 · exact date unknown');
  assert.deepEqual(searchRecords([childhood], '', 'all', '1994'), [childhood]);
});

test('record search combines text, kind and actual year filters', () => {
  const records = getPreviewWorkspace('patient').records;
  assert.equal(searchRecords(records, 'beacon', 'lab_report', '2026').length, 1);
  assert.equal(searchRecords(records, 'beacon', 'prescription', '2026').length, 0);
  assert.equal(searchRecords(records, '', 'all', '1988').length, 2);
  assert.equal(searchRecords(records, 'not-a-real-record', 'all', 'all').length, 0);
});

test('adoptive and unknown relationships remain separate from biological degree', () => {
  const family = getPreviewWorkspace('patient').family;
  assert.equal(family.find((f) => f.relationship === 'half_sibling').degree, 'second');
  assert.equal(family.find((f) => f.basis === 'adoptive').degree, 'not_applicable');
  assert.equal(family.find((f) => f.basis === 'unknown').degree, 'unknown');
  assert.equal(family.find((f) => f.basis === 'unknown').diagnosisAge, null);
});
