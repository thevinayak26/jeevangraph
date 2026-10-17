import test from 'node:test';
import assert from 'node:assert/strict';
import { explainBundledDemo, bundledFacts } from '../src/lib/demo-explanation.ts';
const response = (content) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(content) }] } }] }),
    { status: 200 },
  );
test('no-key and disabled operation work without any external request', async () => {
  for (const config of [{ enabled: false, apiKey: 'test-key' }, { enabled: true }]) {
    const r = await explainBundledDemo({
      ...config,
      fetcher: () => {
        throw new Error('Must not be called');
      },
    });
    assert.equal(r.mode, 'deterministic');
    assert.equal(r.facts.length, 4);
  }
});
test('approved provider output selects only approved text, never model-authored prose', async () => {
  const r = await explainBundledDemo({
    enabled: true,
    apiKey: 'test-key',
    fetcher: async (url, options) => {
      assert.equal(
        url,
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      );
      const body = JSON.parse(options.body);
      assert.deepEqual(JSON.parse(body.contents[0].parts[0].text), bundledFacts);
      assert(!options.body.includes('patient-a'));
      return response({ template: 'evidence_first', factIds: ['F3', 'F1', 'F2', 'F4'] });
    },
  });
  assert.equal(r.mode, 'gemini_selected');
  assert.equal(r.facts[0].text, bundledFacts[2].text);
});
test('quota, malformed and empty provider failures fall back deterministically', async () => {
  for (const fetcher of [
    async () => new Response('', { status: 429 }),
    async () => new Response('not json'),
    async () => new Response('{}'),
  ])
    assert.equal(
      (await explainBundledDemo({ enabled: true, apiKey: 'test-key', fetcher })).mode,
      'deterministic',
    );
});
test('hallucinated IDs, extra prose, missing caveat and duplicate facts are rejected', async () => {
  for (const output of [
    { template: 'timeline', factIds: ['F1', 'F2', 'F3', 'F9'] },
    { template: 'timeline', factIds: ['F1', 'F2', 'F3'], diagnosis: 'invented' },
    { template: 'timeline', factIds: ['F1', 'F2', 'F4'] },
    { template: 'timeline', factIds: ['F1', 'F2', 'F3', 'F3'] },
  ])
    assert.equal(
      (
        await explainBundledDemo({
          enabled: true,
          apiKey: 'test-key',
          fetcher: async () => response(output),
        })
      ).mode,
      'deterministic',
    );
});
test('a hung request is bounded by timeout and aborts', async () => {
  let signal;
  const r = await explainBundledDemo({
    enabled: true,
    apiKey: 'test-key',
    timeoutMs: 10,
    fetcher: (_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    },
  });
  assert.equal(r.mode, 'deterministic');
  assert.equal(signal.aborted, true);
});
test('unapproved model is blocked before network access', async () => {
  assert.equal(
    (
      await explainBundledDemo({
        enabled: true,
        apiKey: 'test-key',
        model: 'unapproved',
        fetcher: () => {
          throw new Error('Must not call');
        },
      })
    ).mode,
    'deterministic',
  );
});

test('every outbound numerical fact matches the canonical bundled source fixtures', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(
    await readFile(new URL('../src/data/synthetic.json', import.meta.url), 'utf8'),
  );
  const patient = fixture.patients.find((p) => p.alias === 'P_AARAV');
  const reports = fixture.records
    .filter((r) => r.patientId === patient.id && r.kind === 'lab_report')
    .sort((a, b) => a.clinicalDate.localeCompare(b.clinicalDate));
  assert.equal(reports.length, 4);
  const values = reports.map(
    (r) => r.observations.find((o) => o.analyteKey === 'creatinine').valueNumeric,
  );
  const dates = reports.map((r) => r.clinicalDate);
  const english = (a) => a.slice(0, -1).join(', ') + ' and ' + a.at(-1);
  assert.equal(
    bundledFacts[0].text,
    `Four fictional creatinine results are ${english(values.map((v) => v.toFixed(2)))} mg/dL on ${english(dates)}.`,
  );
  const delta = values.at(-1) - values[0],
    percent = (delta / values[0]) * 100,
    days = (Date.parse(dates.at(-1)) - Date.parse(dates[0])) / 86400000;
  assert.equal(
    bundledFacts[1].text,
    `The first-to-last numerical change is +${delta.toFixed(2)} mg/dL (+${percent.toFixed(1)}%) over ${days} days.`,
  );
  const egfr = reports.map(
    (r) => r.observations.find((o) => o.analyteKey === 'egfr_reported').valueNumeric,
  );
  assert(
    bundledFacts[3].text.startsWith(`Reported eGFR values are ${english(egfr)} mL/min/1.73m².`),
  );
});
