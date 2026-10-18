import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { proposeScan } from '../src/lib/scan-content.ts';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY,
  app = process.env.JG_APP_URL;
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || !app)
  throw new Error('Local synthetic configuration required');
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
let checks = 0;
const pass = (s) => {
  checks++;
  console.log('PASS: ' + s);
};
const clients = {},
  users = {},
  jars = {},
  run = crypto.randomUUID().slice(0, 8);
for (const role of ['patient', 'empty', 'doctor']) {
  const email = `jg-import-${role}-${run}@example.test`,
    password = 'Synthetic-Import!' + crypto.randomUUID();
  const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  users[role] = { id: user.id, email, password };
  const jar = new Map();
  jars[role] = jar;
  clients[role] = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (r) => r.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  ok(await clients[role].auth.signInWithPassword({ email, password }));
}
await fs.writeFile('.env.scan-test-users.local.json', JSON.stringify(users, null, 2), {
  mode: 0o600,
});
const cookie = (role) => [...jars[role]].map(([k, v]) => `${k}=${v}`).join('; ');
async function ask(role, question) {
  const response = await fetch(app + '/api/history-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie(role) },
    body: JSON.stringify({ question, cloud: false }),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  return response.json();
}
assert.match((await ask('patient', 'Summarize my history')).intro, /no reviewed reports/);
pass('fresh account chat is empty, without bundled patient facts');
const withSkip = await fetch(app + '/secure', {
  headers: { Cookie: cookie('patient') + '; jg_skip_questionnaire=1' },
});
assert.equal(new URL(withSkip.url).pathname, '/secure');
assert((await withSkip.text()).includes('Skip questionnaire during demos'));
pass('demo cookie bypasses first-login questionnaire without writing questionnaire answers');
assert.equal(ok(await clients.patient.from('welcome_assessments').select('*')).length, 0);
const normal = await fetch(app + '/secure', { headers: { Cookie: cookie('patient') } });
assert.equal(new URL(normal.url).pathname, '/secure/welcome');
pass('normal first-login flow remains optional questionnaire');
const base = process.env.JG_FIXTURES_DIR;
if (!base) throw new Error('JG_FIXTURES_DIR required');
const files = (await fs.readdir(base)).filter((v) => v.endsWith('.pdf')).sort();
const versions = [];
for (const file of files) {
  const path = base + '/' + file,
    text = execFileSync('pdftotext', ['-layout', path, '-'], { encoding: 'utf8' });
  const scan = proposeScan([{ page: 1, text, method: 'pdf_text', confidence: null }], file);
  assert(scan.facility);
  assert(scan.date);
  const id = crypto.randomUUID(),
    object = `${users.patient.id}/${id}/source`;
  ok(
    await clients.patient.storage
      .from('health-records')
      .upload(object, await fs.readFile(path), { contentType: 'application/pdf', upsert: false }),
  );
  if (!versions.length)
    assert(
      (
        await clients.patient.rpc('publish_scanned_document', {
          p_id: id,
          p_title: scan.title,
          p_kind: scan.kind,
          p_date: scan.date,
          p_facility: scan.facility,
          p_path: object,
          p_media: 'application/pdf',
          p_content: scan.content,
          p_confirmed: false,
        })
      ).error,
    );
  versions.push(
    ok(
      await clients.patient.rpc('publish_scanned_document', {
        p_id: id,
        p_title: scan.title,
        p_kind: scan.kind,
        p_date: scan.date,
        p_facility: scan.facility,
        p_path: object,
        p_media: 'application/pdf',
        p_content: scan.content,
        p_confirmed: true,
      }),
    ),
  );
}
assert.equal(versions.length, 8);
pass('eight real PDF fixtures extract source fields and publish through reviewed atomic import');
const evidence = await (
  await fetch(app + '/api/evidence', { headers: { Cookie: cookie('patient') } })
).json();
assert.equal(evidence.trends[0].points.length, 4);
assert.equal(evidence.trends[0].change, 0.7);
assert.equal(evidence.trends[0].percent, 77.8);
assert.equal(evidence.trends[0].days, 246);
pass('fresh uploaded history creates exact four-point creatinine chart');
const summary = await ask('patient', 'Summarize my history');
assert.equal(summary.cards.length, 8);
assert.match(summary.intro, /3 recorded facilities/);
pass('chat summary uses the uploaded record count and facilities');
const trend = await ask('patient', 'How has my creatinine changed?');
assert.equal(trend.cards[0].citations.length, 4);
assert.match(trend.cards[0].text, /77.8/);
pass('chat laboratory answer cites four actual owned source versions');
const meds = await ask('patient', 'Which medicines were recorded?');
assert(meds.cards.some((c) => c.text.includes('Loratadine')));
assert(meds.cards.every((c) => c.citations.every((cite) => versions.includes(cite.versionId))));
pass('medicine answers quote uploaded prescriptions with valid source IDs');
const allergies = await ask('patient', 'What allergies are documented?');
assert(allergies.cards.some((c) => c.text.includes('Penicillin')));
pass('allergy answers use source-reported history');
assert.equal((await ask('patient', 'Should I stop my medication?')).cards.length, 0);
pass('treatment questions do not generate a medication recommendation');
assert.match((await ask('empty', 'Summarize my history')).intro, /no reviewed reports/);
pass('unrelated account cannot see imported history through chat');
ok(
  await admin
    .from('memberships')
    .insert({ user_id: users.doctor.id, role: 'doctor', organization: 'Synthetic import clinic' }),
);
ok(
  await clients.patient.rpc('grant_records_with_analysis', {
    p_recipient: users.doctor.id,
    p_purpose: 'Synthetic read grant scope test',
    p_versions: versions,
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
assert.equal(ok(await clients.doctor.from('record_versions').select('id')).length, 8);
assert.match((await ask('doctor', 'Summarize my history')).intro, /no reviewed reports/);
pass(
  'patient-owned history chat never silently expands a clinician record grant into chat processing',
);
const anonymous = await fetch(app + '/api/history-chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ question: 'my history' }),
});
assert.equal(anonymous.status, 401);
pass('anonymous history chat denied');
const dashboard = await (
  await fetch(app + '/secure/intelligence', { headers: { Cookie: cookie('patient') } })
).text();
assert(dashboard.includes('Your reviewed history'));
assert(dashboard.includes('1988-04-15'));
pass('personal dashboard renders lifelong uploaded timeline');
console.log(
  `Import/chat connected checks passed: ${checks}. Synthetic credentials are saved only in ignored local file.`,
);
