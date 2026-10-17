import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidence, relationshipDegree, relativeToViewer } from '../src/lib/evidence.ts';
const viewer = 'patient-a';
function version(id, date, value = '0.90', unit = 'mg/dL', extra = {}) {
  return {
    id,
    record_id: 'record-' + id,
    owner_id: viewer,
    title: 'Report ' + id,
    kind: 'lab_report',
    clinical_date: date,
    facility: 'Synthetic clinic',
    reviewed_at: '2026-10-18T00:00:00Z',
    superseded_at: null,
    object_path: 'private/source',
    content: {
      notes: '',
      observations: [
        {
          label: 'Creatinine',
          value,
          unit,
          sourceExcerpt: `Creatinine ${value} ${unit}`,
          sourcePage: 1,
        },
      ],
    },
    ...extra,
  };
}
test('four-point trend retains exact sources and computes 0.70 / 77.8% / 246 days', () => {
  const p = buildEvidence(
    [
      version('1', '2026-01-06'),
      version('2', '2026-03-17', '1.10'),
      version('3', '2026-06-19', '1.40'),
      version('4', '2026-09-09', '1.60'),
    ],
    viewer,
  );
  assert.equal(p.trends[0].change, 0.7);
  assert.equal(p.trends[0].percent, 77.8);
  assert.equal(p.trends[0].days, 246);
  assert.deepEqual(
    p.trends[0].points.map((x) => x.versionId),
    ['1', '2', '3', '4'],
  );
});
test('micromolar conversion preserves raw value and unit provenance', () => {
  const p = buildEvidence([version('1', '2026-01-06', '88.4', 'µmol/L')], viewer);
  assert.equal(p.trends[0].points[0].value, 1);
  assert.equal(p.trends[0].points[0].rawValue, '88.4');
  assert.equal(p.trends[0].points[0].converted, true);
});
test('ambiguous dates, values, unsupported units and ungrounded excerpts are excluded', () => {
  for (const v of [
    version('1', null),
    version('2', '2026-02-30'),
    version('3', '2026-01-06', '>1.2'),
    version('4', '2026-01-06', '1,2'),
    version('5', '2026-01-06', '-1'),
    version('6', '2026-01-06', '1.2', 'unknown'),
    version('7', '2026-01-06', '1.2', 'mg/dL', {
      content: {
        notes: '',
        observations: [
          {
            label: 'Creatinine',
            value: '1.2',
            unit: 'mg/dL',
            sourceExcerpt: 'Creatinine 11.2 mg/dL',
            sourcePage: 1,
          },
        ],
      },
    }),
  ]) {
    const p = buildEvidence([v], viewer);
    assert.equal(p.trends.length, 0);
    assert.equal(p.exclusions.length, 1);
  }
});
test('same-day samples are excluded rather than arbitrarily ordered', () => {
  const p = buildEvidence([version('1', '2026-01-06'), version('2', '2026-01-06', '1.20')], viewer);
  assert.equal(p.trends.length, 0);
  assert.equal(p.exclusions.length, 2);
});
test('separate people never form one longitudinal trend', () => {
  const p = buildEvidence(
    [
      version('1', '2026-01-06'),
      version('2', '2026-03-17', '9.0', 'mg/dL', { owner_id: 'patient-b' }),
    ],
    viewer,
  );
  assert.equal(p.trends.length, 2);
  assert(p.trends.every((t) => t.change === null));
});
test('superseded versions leave derived trend and graph', () => {
  const a = version('1', '2026-01-06');
  const p = buildEvidence(
    [{ ...a, superseded_at: '2026-10-18T00:00:00Z' }, version('2', '2026-01-06', '1.1')],
    viewer,
  );
  assert.equal(p.trends[0].points.length, 1);
  assert(!p.graph.nodes.some((n) => n.id === 'record:1'));
  assert.equal(p.exclusions[0].versionId, '1');
});
test('reported eGFR is retained as reported, without deriving creatinine or staging', () => {
  const v = version('1', '2026-01-06');
  v.content.observations = [
    {
      label: 'eGFR',
      value: '57',
      unit: 'mL/min/1.73m²',
      sourceExcerpt: 'eGFR 57 mL/min/1.73m²',
      sourcePage: 1,
    },
  ];
  const p = buildEvidence([v], viewer);
  assert.equal(p.trends[0].points.length, 0);
  assert.equal(p.trends[0].reportedEgfr[0].value, 57);
  assert.equal(p.trends[0].change, null);
});
test('biological degree and inverse relationships preserve lineage without treating adoption as genetics', () => {
  assert.equal(relationshipDegree('father', 'biological'), 1);
  assert.equal(relationshipDegree('grandparent', 'biological'), 2);
  assert.equal(relationshipDegree('half_sibling', 'biological'), 2);
  assert.equal(relationshipDegree('father', 'adoptive'), null);
  assert.equal(relationshipDegree('mother', 'unknown'), null);
  assert.equal(
    relativeToViewer(
      { inviter_id: 'adult-child', invitee_id: 'parent', relationship: 'father' },
      'parent',
    ),
    'child',
  );
});
test('accepted link has no condition without an independently visible assertion', () => {
  const links = [
    {
      id: 'l',
      inviter_id: viewer,
      invitee_id: 'relative',
      relationship: 'father',
      basis: 'biological',
      ended_at: null,
    },
  ];
  const p = buildEvidence([], viewer, links);
  assert.equal(p.family.length, 0);
  assert(p.graph.nodes.some((n) => n.kind === 'relative'));
  assert(!p.graph.nodes.some((n) => n.kind === 'family'));
});
test('ending a link and withdrawing reported history remove derived family nodes', () => {
  const p = buildEvidence(
    [],
    viewer,
    [
      {
        id: 'l',
        inviter_id: viewer,
        invitee_id: 'relative',
        relationship: 'father',
        basis: 'biological',
        ended_at: '2026-10-18',
      },
    ],
    [
      {
        id: 'a',
        owner_id: 'relative',
        condition: 'Diabetes',
        age_at_diagnosis: 48,
        source_kind: 'self_reported',
        source_version_id: null,
        created_at: '',
      },
    ],
    [
      {
        id: 'h',
        owner_id: viewer,
        relationship: 'mother',
        basis: 'biological',
        condition: 'Breast cancer',
        age_at_diagnosis: 44,
        withdrawn_at: '2026-10-18',
      },
    ],
  );
  assert.equal(p.family.length, 0);
  assert(!p.graph.nodes.some((n) => ['relative', 'family'].includes(n.kind)));
});
test('relative assertion is contextual, source files are not inferred or linked', () => {
  const p = buildEvidence(
    [],
    viewer,
    [
      {
        id: 'l',
        inviter_id: viewer,
        invitee_id: 'relative',
        relationship: 'father',
        basis: 'biological',
        ended_at: null,
      },
    ],
    [
      {
        id: 'a',
        owner_id: 'relative',
        condition: 'Diabetes',
        age_at_diagnosis: 48,
        source_kind: 'document_linked',
        source_version_id: null,
        created_at: '',
      },
    ],
  );
  assert.equal(p.family[0].age, 48);
  assert.equal(p.family[0].degree, 1);
  assert(!p.graph.nodes.find((n) => n.id === 'assertion:a').versionId);
});
