import test from 'node:test';
import assert from 'node:assert/strict';
import { assessmentSchema, assessmentNotes } from '../src/lib/assessment.ts';
const base = {
  region: 'north_india',
  environment: 'urban',
  allergies: ['unknown'],
  conditions: ['unknown'],
  exposure: 'unknown',
  family_condition: 'unknown',
  relationship: 'unknown',
  basis: 'unknown',
  age_at_diagnosis: null,
};
test('questionnaire permits undisclosed context and unknown history', () => {
  assert.equal(assessmentSchema.safeParse({ ...base, region: 'undisclosed' }).success, true);
});
test('questionnaire rejects contradictory, duplicate, injected choices and out-of-range ages', () => {
  for (const change of [
    { allergies: ['unknown', 'food'] },
    { conditions: ['none_known', 'asthma'] },
    { allergies: ['food', 'food'] },
    { region: 'precise GPS coordinates' },
    { age_at_diagnosis: 121 },
    { age_at_diagnosis: -1 },
    { age_at_diagnosis: 4.5 },
    { unexpected: 'instruction' },
  ])
    assert.equal(assessmentSchema.safeParse({ ...base, ...change }).success, false);
});
test('reported family conditions require relationship but never imply genetic proof', () => {
  assert.equal(
    assessmentSchema.safeParse({ ...base, family_condition: 'diabetes' }).success,
    false,
  );
  const notes = assessmentNotes({
    ...base,
    family_condition: 'diabetes',
    relationship: 'parent',
    basis: 'biological',
  }).join(' ');
  assert.match(notes, /does not prove a genetic variant/);
  assert.match(
    assessmentNotes({
      ...base,
      family_condition: 'diabetes',
      relationship: 'parent',
      basis: 'adoptive',
    }).join(' '),
    /not classified as inherited/,
  );
});
test('regional context never invents prevalence and exposures do not diagnose', () => {
  const notes = assessmentNotes({ ...base, exposure: 'both', allergies: ['food'] }).join(' ');
  assert.match(notes, /no live local surveillance/);
  assert.match(notes, /does not mean dengue or malaria is present/);
  assert.match(notes, /cannot confirm or rule out an allergy/);
});
