import test from 'node:test';
import assert from 'node:assert/strict';
import { answerHistory, localTopic } from '../src/lib/history-chat.ts';
import { routeSyntheticQuestion } from '../src/lib/chat-router.ts';
const projection = {
  trends: [],
  exclusions: [],
  graph: { nodes: [], links: [] },
  family: [],
  revision: 'test',
};
const record = {
  id: 'own-source',
  record_id: 'r',
  owner_id: 'p',
  title: 'Reviewed prescription',
  kind: 'prescription',
  clinical_date: '2026-01-06',
  facility: 'Synthetic clinic',
  reviewed_at: '2026-01-06',
  superseded_at: null,
  content: {
    notes:
      '[Source page 1; PDF text extraction]\nMedication: Fictional historic entry.\nAllergy history: Penicillin - rash; patient-reported.\nFamily history: Father, diabetes at 48.',
    observations: [],
  },
};
test('new-account chat never falls back to bundled patient fixtures', () => {
  const a = answerHistory('summarize my history', [], projection);
  assert.match(a.intro, /no reviewed reports/);
  assert.equal(a.cards.length, 0);
  assert(!JSON.stringify(a).includes('0.90'));
});
test('medicine and allergy answers quote reviewed source text with exact source ID and page', () => {
  for (const q of ['Which medicines were recorded?', 'What allergies are documented?']) {
    const a = answerHistory(q, [record], projection);
    assert.equal(a.cards.length, 1);
    assert.equal(a.cards[0].citations[0].versionId, 'own-source');
    assert.equal(a.cards[0].citations[0].page, 1);
    assert(record.content.notes.includes(a.cards[0].citations[0].excerpt));
  }
});
test('diagnosis and treatment requests produce no invented medical advice', () => {
  for (const q of [
    'Do I have kidney disease?',
    'Should I stop medication?',
    'What dose should I take?',
  ])
    assert.equal(answerHistory(q, [record], projection).cards.length, 0);
});
test('superseded records never appear in history answers and unknown topics stay bounded', () => {
  assert.equal(
    answerHistory('medicines', [{ ...record, superseded_at: '2026-06-01' }], projection).cards
      .length,
    0,
  );
  assert.equal(localTopic('Write a poem'), 'unknown');
  assert.equal(answerHistory('Write a poem', [record], projection).cards.length, 0);
});
test('Gemini is optional, never receives record text, validates schema and falls back on quota failure', async () => {
  let calls = 0;
  assert.equal(
    await routeSyntheticQuestion('Question', {
      enabled: false,
      fetcher: async () => {
        calls++;
      },
    }),
    null,
  );
  assert.equal(calls, 0);
  const topic = await routeSyntheticQuestion('Which medicines were recorded?', {
    enabled: true,
    apiKey: 'synthetic-key',
    fetcher: async (_url, request) => {
      calls++;
      assert(!request.body.includes('Penicillin'));
      assert(!request.body.includes('own-source'));
      return Response.json({
        candidates: [{ content: { parts: [{ text: '{"topic":"medicines"}' }] } }],
      });
    },
  });
  assert.equal(topic, 'medicines');
  assert.equal(
    await routeSyntheticQuestion('Question', {
      enabled: true,
      apiKey: 'test',
      fetcher: async () => new Response('', { status: 429 }),
    }),
    null,
  );
  assert.equal(
    await routeSyntheticQuestion('Question', {
      enabled: true,
      apiKey: 'test',
      fetcher: async () =>
        Response.json({
          candidates: [
            { content: { parts: [{ text: '{"topic":"medicines","advice":"start a drug"}' }] } },
          ],
        }),
    }),
    null,
  );
});
