import { syntheticPdf } from './synthetic-pdf.mjs';
// Synthetic local Supabase integration tests. Never run against a patient-data project.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !service || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
  throw new Error('Local Supabase configuration required. Refusing non-local project.');
const admin = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const run = crypto.randomUUID().slice(0, 8);
const password = 'Synthetic-only!' + crypto.randomUUID();
const clients = {};
const identities = {};
const cookieJars = {};
function ok(result) {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}
function pass(label) {
  console.log('PASS: ' + label);
}
for (const role of ['patient', 'doctor', 'otherdoctor', 'stranger', 'facility', 'platform']) {
  const email = `jg-${role}-${run}@example.test`;
  const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  identities[role] = { id: user.id, email, password };
  const jar = new Map();
  cookieJars[role] = jar;
  clients[role] = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) => values.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  ok(await clients[role].auth.signInWithPassword({ email, password }));
}
await fs.writeFile('.env.synthetic-users.local.json', JSON.stringify(identities, null, 2), {
  mode: 0o600,
});
for (const role of ['doctor', 'otherdoctor', 'facility', 'platform'])
  ok(
    await admin.from('memberships').insert({
      user_id: identities[role].id,
      role: role === 'otherdoctor' ? 'doctor' : role,
      organization: role === 'facility' ? 'Hospital A' : 'Synthetic clinic',
    }),
  );
const p = clients.patient,
  d = clients.doctor,
  s = clients.stranger,
  f = clients.facility;
const versions = [];
const paths = [];
const dates = ['2026-01-06', '2026-03-17', '2026-06-19', '2026-09-09'];
const source = syntheticPdf(dates[0], '0.90');
for (const [i, value] of ['0.90', '1.10', '1.40', '1.60'].entries()) {
  const id = crypto.randomUUID();
  const path = `${identities.patient.id}/${id}/source`;
  paths.push(path);
  ok(
    await p.storage.from('health-records').upload(path, syntheticPdf(dates[i], value), {
      contentType: 'application/pdf',
      upsert: false,
    }),
  );
  ok(
    await p.rpc('create_draft', {
      p_id: id,
      p_record: null,
      p_title: `Synthetic renal ${i + 1}`,
      p_kind: 'lab_report',
      p_date: ['2026-01-06', '2026-03-17', '2026-06-19', '2026-09-09'][i],
      p_facility: 'Synthetic clinic',
      p_path: path,
      p_media: 'application/pdf',
    }),
  );
  const content = {
    notes: 'Fictional report. No clinical interpretation.',
    observations: [
      {
        label: 'Creatinine',
        value,
        unit: 'mg/dL',
        sourceExcerpt: `Creatinine ${value} mg/dL`,
        sourcePage: 1,
      },
    ],
  };
  versions.push(ok(await p.rpc('review_draft', { p_id: id, p_content: content })));
}
pass('four private sources uploaded and four reviewed versions persisted');
assert.equal(ok(await d.from('record_versions').select('id')).length, 0);
pass('doctor denied before consent');
const grant = ok(
  await p.rpc('grant_records', {
    p_recipient: identities.doctor.id,
    p_purpose: 'Synthetic consultation',
    p_versions: versions,
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
assert.equal(ok(await d.from('record_versions').select('id')).length, 4);
pass('doctor receives exactly four granted versions');
for (const role of ['stranger', 'otherdoctor', 'facility', 'platform'])
  assert.equal(ok(await clients[role].from('record_versions').select('id')).length, 0);
pass('wrong patient, unselected doctor, facility and platform accounts have no chart access');
assert.equal(ok(await d.from('record_drafts').select('id')).length, 0);
assert((await d.storage.from('health-records').createSignedUrl(paths[0], 3600)).error);
pass('doctor cannot obtain reusable storage link');
assert((await s.storage.from('health-records').download(paths[0])).error);
pass('wrong-user source download denied');
assert(
  (
    await s.storage
      .from('health-records')
      .upload(`${identities.patient.id}/${crypto.randomUUID()}/source`, source, {
        contentType: 'application/pdf',
      })
  ).error,
);
pass('cross-owner upload denied');
assert((await p.from('record_versions').update({ title: 'tampered' }).eq('id', versions[0])).error);
pass('immutable versions cannot be edited');
assert(
  (
    await p
      .from('memberships')
      .insert({ user_id: identities.patient.id, role: 'doctor', organization: 'Fake' })
  ).error,
);
pass('self-provisioned doctor role denied');
const app = process.env.JG_APP_URL;
const cookies = (role) =>
  [...cookieJars[role]].map(([name, value]) => `${name}=${value}`).join('; ');
if (app) {
  const response = await fetch(`${app}/api/private-source/${versions[0]}`, {
    headers: { Cookie: cookies('doctor') },
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal((await response.arrayBuffer()).byteLength, source.byteLength);
  pass('signed-in doctor source delivery succeeds without cache or signed URL');
  const denied = await fetch(`${app}/api/private-source/${versions[0]}`, {
    headers: { Cookie: cookies('stranger') },
  });
  assert.equal(denied.status, 404);
  pass('source endpoint denies wrong session');
  const html = await (
    await fetch(`${app}/secure`, { headers: { Cookie: cookies('patient') } })
  ).text();
  assert(html.includes('Synthetic renal 1'));
  pass('signed-in workspace renders persistent patient records');
}
ok(await admin.from('memberships').update({ active: false }).eq('user_id', identities.doctor.id));
assert.equal(ok(await d.from('record_versions').select('id')).length, 0);
pass('deactivated professional loses access despite an unexpired grant');
ok(await admin.from('memberships').update({ active: true }).eq('user_id', identities.doctor.id));
const firstRecord = ok(await p.from('record_versions').select('record_id').eq('id', versions[0]))[0]
  .record_id;
const correctionDraft = crypto.randomUUID();
const correctionPath = `${identities.patient.id}/${correctionDraft}/source`;
ok(
  await p.storage
    .from('health-records')
    .upload(correctionPath, source, { contentType: 'application/pdf', upsert: false }),
);
ok(
  await p.rpc('create_draft', {
    p_id: correctionDraft,
    p_record: firstRecord,
    p_title: 'Synthetic correction',
    p_kind: 'lab_report',
    p_date: null,
    p_facility: 'Synthetic clinic',
    p_path: correctionPath,
    p_media: 'application/pdf',
  }),
);
const correction = ok(
  await p.rpc('review_draft', {
    p_id: correctionDraft,
    p_content: { notes: 'Synthetic correction, requires separate sharing', observations: [] },
  }),
);
assert.equal(ok(await d.from('record_versions').select('id').eq('id', correction)).length, 0);
pass('correction version is excluded from an existing exact-version grant');
ok(await p.rpc('revoke_grant', { p_id: grant }));
assert.equal(ok(await d.from('record_versions').select('id')).length, 0);
assert((await d.rpc('read_source', { p_version: versions[0] })).error);
pass('revocation blocks fresh doctor reads and source authorization');
if (app)
  assert.equal(
    (
      await fetch(`${app}/api/private-source/${versions[0]}`, {
        headers: { Cookie: cookies('doctor') },
      })
    ).status,
    404,
  );
const expiring = ok(
  await p.rpc('grant_records', {
    p_recipient: identities.doctor.id,
    p_purpose: 'Expiry test',
    p_versions: [versions[0]],
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
ok(
  await admin
    .from('consent_grants')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', expiring),
);
assert.equal(ok(await d.from('record_versions').select('id')).length, 0);
pass('expired grant denied through actual session');
const ticket = ok(
  await p.rpc('authorize_ingestion', {
    p_facility: identities.facility.id,
    p_org: 'Hospital A',
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
const payload = {
  p_ticket: ticket,
  p_key: crypto.randomUUID(),
  p_title: 'Simulated facility lab',
  p_date: '2026-10-18',
  p_content: { notes: 'Synthetic facility submission', observations: [] },
};
assert((await s.rpc('ingest_simulated', payload)).error);
pass('ticket cannot be used by another account');
const delivered = ok(await f.rpc('ingest_simulated', payload));
assert.equal(ok(await f.rpc('ingest_simulated', payload)), delivered);
assert((await f.rpc('ingest_simulated', { ...payload, p_title: 'Changed payload' })).error);
pass('ingestion is idempotent and changed replay denied');
assert.equal(ok(await f.from('record_drafts').select('id')).length, 0);
assert.equal(ok(await p.from('record_drafts').select('id').eq('id', delivered))[0].id, delivered);
pass('facility submission awaits patient review without facility chart access');
const anon = createClient(url, key, { auth: { persistSession: false } });
assert((await anon.from('record_versions').select('id')).error);
pass('anonymous chart query denied');
assert(ok(await p.from('audit_events').select('id')).length > 0);
pass('patient audit events persisted');
console.log('Connected tests passed. Synthetic accounts saved only in ignored local file.');
