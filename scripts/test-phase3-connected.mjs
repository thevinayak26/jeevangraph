// Local-only synthetic end-to-end authorization and derived-data checks.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { syntheticPdf } from './synthetic-pdf.mjs';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
  key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !secret || !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Local-only configuration required. Refusing non-local Supabase.');
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
function ok(r) {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}
function pass(s) {
  console.log('PASS: ' + s);
}
const users = {},
  clients = {},
  jars = {};
const run = crypto.randomUUID().slice(0, 8);
const password = 'Synthetic-Phase3!' + crypto.randomUUID();
for (const role of ['patient', 'relative', 'stranger', 'doctor', 'grandparent']) {
  const email = `jg-phase3-${role}-${run}@example.test`;
  const { user } = ok(await admin.auth.admin.createUser({ email, password, email_confirm: true }));
  users[role] = { id: user.id, email, password };
  const jar = new Map();
  jars[role] = jar;
  clients[role] = createServerClient(url, key, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (rows) => rows.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  ok(await clients[role].auth.signInWithPassword({ email, password }));
}
await fs.writeFile('.env.phase3-users.local.json', JSON.stringify(users, null, 2), { mode: 0o600 });
ok(
  await admin
    .from('memberships')
    .insert({ user_id: users.doctor.id, role: 'doctor', organization: 'Synthetic clinic' }),
);
const p = clients.patient,
  r = clients.relative,
  s = clients.stranger,
  d = clients.doctor;
const cookies = (role) => [...jars[role]].map(([name, value]) => `${name}=${value}`).join('; ');
const app = process.env.JG_APP_URL;
async function projection(role) {
  assert(app, 'JG_APP_URL is required for Phase 3 API verification');
  const response = await fetch(app + '/api/evidence', {
    headers: { Cookie: cookies(role) },
    cache: 'no-store',
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  return response.json();
}
async function publish(
  client,
  owner,
  date,
  value,
  record = null,
  title = 'Synthetic renal report',
  facility = 'Synthetic clinic',
) {
  const id = crypto.randomUUID(),
    path = `${owner}/${id}/source`;
  ok(
    await client.storage
      .from('health-records')
      .upload(path, syntheticPdf(date, value, facility), {
        contentType: 'application/pdf',
        upsert: false,
      }),
  );
  ok(
    await client.rpc('create_draft', {
      p_id: id,
      p_record: record,
      p_title: title,
      p_kind: 'lab_report',
      p_date: date,
      p_facility: facility,
      p_path: path,
      p_media: 'application/pdf',
    }),
  );
  const version = ok(
    await client.rpc('review_draft', {
      p_id: id,
      p_content: {
        notes: 'Fictional test report. No diagnosis.',
        observations: [
          {
            label: 'Creatinine',
            value,
            unit: 'mg/dL',
            sourceExcerpt: `Creatinine ${value} mg/dL`,
            sourcePage: 1,
          },
        ],
      },
    }),
  );
  const row = ok(await client.from('record_versions').select('id,record_id').eq('id', version))[0];
  return row;
}
const records = [];
for (const [i, value] of ['0.90', '1.10', '1.40', '1.60'].entries())
  records.push(
    await publish(
      p,
      users.patient.id,
      ['2026-01-06', '2026-03-17', '2026-06-19', '2026-09-09'][i],
      value,
      null,
      `Synthetic renal ${i + 1}`,
      [
        'Aster Grove Demo Hospital',
        'Beacon Vale Demo Diagnostics',
        'Cedar Bridge Demo Hospital',
        'Aster Grove Demo Hospital',
      ][i],
    ),
  );
if (app) {
  const initial = await projection('patient');
  assert.equal(initial.trends[0].change, 0.7);
  assert.equal(initial.trends[0].percent, 77.8);
  assert.equal(initial.trends[0].days, 246);
  pass('authenticated evidence computes exact four-report trend from persisted reviewed sources');
}
const relativeSource = await publish(r, users.relative.id, '2026-01-06', '1.00');
const assertion = ok(
  await r.rpc('add_family_assertion', {
    p_condition: 'Type 2 diabetes',
    p_age: 48,
    p_source: null,
  }),
);
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 0);
pass('unlinked relative condition is private');
const invitation = ok(
  await p.rpc('create_family_invitation', {
    p_invitee: users.relative.id,
    p_relationship: 'father',
    p_basis: 'biological',
    p_adult: true,
  }),
);
assert((await p.from('family_invitations').select('token_hash')).error);
assert(
  (
    await s.rpc('accept_family_invitation', {
      p_id: invitation.id,
      p_token: invitation.token,
      p_adult: true,
    })
  ).error,
);
pass('invitation secrets are withheld from table reads and bound to the named recipient');
assert(
  (
    await r.rpc('accept_family_invitation', {
      p_id: invitation.id,
      p_token: 'a'.repeat(64),
      p_adult: true,
    })
  ).error,
);
assert(
  (
    await r.rpc('accept_family_invitation', {
      p_id: invitation.id,
      p_token: invitation.token,
      p_adult: false,
    })
  ).error,
);
pass('wrong secret and missing adult attestation are rejected');
const link = ok(
  await r.rpc('accept_family_invitation', {
    p_id: invitation.id,
    p_token: invitation.token,
    p_adult: true,
  }),
);
assert(
  (
    await r.rpc('accept_family_invitation', {
      p_id: invitation.id,
      p_token: invitation.token,
      p_adult: true,
    })
  ).error,
);
pass('one-time family invitation cannot be replayed');
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 0);
assert.equal(
  ok(await p.from('record_versions').select('id').eq('owner_id', users.relative.id)).length,
  0,
);
pass('accepting a relationship grants no conditions or reports');
let share = ok(
  await r.rpc('share_family_assertion', {
    p_assertion: assertion,
    p_recipient: users.patient.id,
    p_purpose: 'Family history discussion',
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
assert.equal(ok(await p.rpc('visible_family_assertions'))[0].condition, 'Type 2 diabetes');
assert.equal(ok(await p.from('family_assertions').select('id')).length, 0);
pass('explicit assertion share appears only through its authorized projection');
if (app) {
  const e = await projection('patient');
  assert.equal(e.family[0].degree, 1);
  assert(e.graph.nodes.some((n) => n.label === 'Type 2 diabetes'));
  assert(!e.graph.nodes.some((n) => n.versionId === relativeSource.id));
  pass('HealthGraph includes the shared family context without loading the relative report');
}
const reported = ok(
  await p.rpc('add_reported_family_history', {
    p_relationship: 'mother',
    p_basis: 'biological',
    p_condition: 'Breast cancer',
    p_age: 44,
  }),
);
const readOnly = ok(
  await p.rpc('grant_records', {
    p_recipient: users.doctor.id,
    p_purpose: 'Read-only permission test',
    p_versions: records.map((v) => v.id),
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
assert.equal(ok(await d.from('record_versions').select('id')).length, 4);
assert.equal(ok(await d.rpc('authorized_analysis_versions')).length, 0);
if (app) assert.equal((await projection('doctor')).trends.length, 0);
ok(await p.rpc('revoke_grant', { p_id: readOnly }));
pass('read-only record grant does not authorize numerical insights or record graph');
const doctorGrant = ok(
  await p.rpc('grant_records_with_analysis', {
    p_recipient: users.doctor.id,
    p_purpose: 'Synthetic consultation',
    p_versions: records.map((v) => v.id),
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
assert.equal(ok(await d.rpc('visible_family_assertions')).length, 0);
assert.equal(ok(await d.from('reported_family_history').select('id')).length, 0);
if (app) {
  const e = await projection('doctor');
  assert.equal(e.trends[0].points.length, 4);
  assert.equal(e.family.length, 0);
  assert(!JSON.stringify(e).includes('Type 2 diabetes'));
  assert(!JSON.stringify(e).includes('Breast cancer'));
}
pass('doctor record grant does not include either independent or patient-reported family history');
assert(
  (
    await p.rpc('share_family_assertion', {
      p_assertion: assertion,
      p_recipient: users.doctor.id,
      p_purpose: 'Onward sharing test',
      p_expiry: new Date(Date.now() + 3600000).toISOString(),
    })
  ).error,
);
pass('recipient cannot onward-share a relative assertion');
ok(await r.rpc('revoke_family_share', { p_id: share }));
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 0);
if (app)
  assert(!(await projection('patient')).graph.nodes.some((n) => n.label === 'Type 2 diabetes'));
pass('revoked assertion disappears from fresh family projection and graph');
share = ok(
  await r.rpc('share_family_assertion', {
    p_assertion: assertion,
    p_recipient: users.patient.id,
    p_purpose: 'Expiry verification',
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
ok(
  await admin
    .from('family_assertion_shares')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', share),
);
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 0);
pass('expired family share is denied');
const documented = ok(
  await r.rpc('add_family_assertion', {
    p_condition: 'Synthetic renal follow-up',
    p_age: null,
    p_source: relativeSource.id,
  }),
);
ok(
  await r.rpc('share_family_assertion', {
    p_assertion: documented,
    p_recipient: users.patient.id,
    p_purpose: 'Family source provenance',
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
assert.equal(
  ok(await p.rpc('visible_family_assertions')).find((a) => a.id === documented).source_version_id,
  null,
);
assert((await p.rpc('read_source', { p_version: relativeSource.id })).error);
pass('document-linked family assertion does not reveal a source UUID or original file');
await publish(
  r,
  users.relative.id,
  '2026-01-06',
  '1.05',
  relativeSource.record_id,
  'Corrected relative source',
);
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 0);
pass('corrected supporting report invalidates the old shared assertion');
const correction = await publish(
  p,
  users.patient.id,
  '2026-01-06',
  '0.90',
  records[0].record_id,
  'Corrected synthetic renal 1',
  'Aster Grove Demo Hospital',
);
if (app) {
  const e = await projection('doctor');
  assert.equal(e.trends[0].points.length, 3);
  assert(!e.graph.nodes.some((n) => n.versionId === records[0].id));
  assert(!e.graph.nodes.some((n) => n.versionId === correction.id));
  pass(
    'superseded grant version leaves derived results and its replacement is not automatically shared',
  );
}
ok(await p.rpc('revoke_grant', { p_id: doctorGrant }));
if (app) {
  const e = await projection('doctor');
  assert.equal(e.trends.length, 0);
  assert(!e.graph.nodes.some((n) => n.kind === 'record'));
  pass('record revocation clears fresh insight and graph output');
}
const expiredInvite = ok(
  await p.rpc('create_family_invitation', {
    p_invitee: users.grandparent.id,
    p_relationship: 'grandparent',
    p_basis: 'biological',
    p_adult: true,
  }),
);
ok(
  await admin
    .from('family_invitations')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', expiredInvite.id),
);
assert(
  (
    await clients.grandparent.rpc('accept_family_invitation', {
      p_id: expiredInvite.id,
      p_token: expiredInvite.token,
      p_adult: true,
    })
  ).error,
);
pass('expired invitation cannot be accepted');
const revokedInvite = ok(
  await p.rpc('create_family_invitation', {
    p_invitee: users.grandparent.id,
    p_relationship: 'grandparent',
    p_basis: 'biological',
    p_adult: true,
  }),
);
ok(await p.rpc('revoke_family_invitation', { p_id: revokedInvite.id }));
assert(
  (
    await clients.grandparent.rpc('accept_family_invitation', {
      p_id: revokedInvite.id,
      p_token: revokedInvite.token,
      p_adult: true,
    })
  ).error,
);
pass('revoked invitation cannot be accepted');
share = ok(
  await r.rpc('share_family_assertion', {
    p_assertion: assertion,
    p_recipient: users.patient.id,
    p_purpose: 'Link termination test',
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
ok(await p.rpc('end_family_link', { p_id: link }));
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 0);
pass('either relative can end a relationship and invalidate its shares');
const withdrawal = ok(
  await r.rpc('add_family_assertion', {
    p_condition: 'Temporary synthetic assertion',
    p_age: null,
    p_source: null,
  }),
);
ok(await r.rpc('withdraw_family_assertion', { p_id: withdrawal }));
assert(!ok(await r.rpc('visible_family_assertions')).some((a) => a.id === withdrawal));
pass('withdrawn assertion is excluded even from current owner projection');
ok(await p.rpc('withdraw_reported_family_history', { p_id: reported }));
// Leave an explicit, consented synthetic family story for the local demonstration.
const demoInvite = ok(
  await p.rpc('create_family_invitation', {
    p_invitee: users.relative.id,
    p_relationship: 'father',
    p_basis: 'biological',
    p_adult: true,
  }),
);
ok(
  await r.rpc('accept_family_invitation', {
    p_id: demoInvite.id,
    p_token: demoInvite.token,
    p_adult: true,
  }),
);
ok(
  await r.rpc('share_family_assertion', {
    p_assertion: assertion,
    p_recipient: users.patient.id,
    p_purpose: 'Synthetic family-history demo',
    p_expiry: new Date(Date.now() + 86400000).toISOString(),
  }),
);
ok(
  await p.rpc('add_reported_family_history', {
    p_relationship: 'mother',
    p_basis: 'biological',
    p_condition: 'Breast cancer',
    p_age: 44,
  }),
);
ok(
  await p.rpc('add_reported_family_history', {
    p_relationship: 'grandparent',
    p_basis: 'biological',
    p_condition: 'Hypertension',
    p_age: 52,
  }),
);
if (app) {
  const e = await projection('patient');
  assert.equal(e.trends[0].change, 0.7);
  assert.equal(e.family.length, 3);
  assert.equal(e.graph.nodes.filter((n) => n.kind === 'facility').length, 3);
  assert(e.family.some((f) => f.degree === 2));
  const anon = await fetch(app + '/api/evidence');
  assert.equal(anon.status, 401);
  pass('final local demo has first/second-degree context and anonymous evidence access is denied');
}
console.log(
  'Phase 3 connected tests passed. Synthetic local account credentials are in the ignored .env.phase3-users.local.json file.',
);
