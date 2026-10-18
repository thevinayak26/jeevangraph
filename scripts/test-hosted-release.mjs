// Explicitly scoped synthetic smoke test. Local-only suites keep their original guards.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { syntheticPdf } from './synthetic-pdf.mjs';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
const app = process.env.JG_APP_URL;
if (
  !url ||
  new URL(url).hostname !== 'mlsrnsudpmveclwxsaja.supabase.co' ||
  process.env.JG_CONFIRM_SYNTHETIC_HOSTED_TEST !== 'jeevangraph' ||
  !key ||
  !secret ||
  !app ||
  new URL(app).protocol !== 'https:'
)
  throw new Error('Exact approved synthetic cloud target and HTTPS app required');
const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const ok = (r) => {
  if (r.error) throw new Error(r.error.message);
  return r.data;
};
let count = 0;
const pass = (s) => {
  count++;
  console.log('PASS: ' + s);
};
const run = crypto.randomUUID().slice(0, 8),
  users = {},
  clients = {},
  jars = {};
for (const role of ['patient', 'doctor', 'relative', 'stranger']) {
  const email = `jg-release-${role}-${run}@example.test`,
    password = 'Synthetic-Release!' + crypto.randomUUID();
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
await fs.writeFile('.env.hosted-synthetic-users.local.json', JSON.stringify(users, null, 2), {
  mode: 0o600,
});
ok(
  await admin.from('memberships').insert({
    user_id: users.doctor.id,
    role: 'doctor',
    organization: 'Synthetic release verification clinic',
  }),
);
const p = clients.patient,
  d = clients.doctor,
  r = clients.relative,
  s = clients.stranger;
const cookie = (role) => [...jars[role]].map(([name, value]) => `${name}=${value}`).join('; ');
const page = (path, role) =>
  fetch(app + path, { headers: role ? { Cookie: cookie(role) } : {}, cache: 'no-store' });
const first = await page('/secure', 'patient');
assert.equal(new URL(first.url).pathname, '/secure/welcome');
pass('hosted first login opens optional questionnaire');
const answers = {
  schema_version: 1,
  region: 'north_india',
  environment: 'urban',
  allergies: ['dust_pollen'],
  conditions: ['unknown'],
  exposure: 'dust_smoke',
  family_condition: 'diabetes',
  relationship: 'parent',
  basis: 'biological',
  age_at_diagnosis: 48,
};
ok(await p.rpc('save_welcome_assessment', { p_answers: answers }));
assert.equal(ok(await d.from('welcome_assessments').select('*')).length, 0);
assert.equal(ok(await s.from('welcome_assessments').select('*')).length, 0);
assert((await p.rpc('save_welcome_assessment', { p_answers: { ...answers, region: null } })).error);
pass('hosted questionnaire stays owner-only and rejects invalid answers');
const summary = await (await page('/secure/welcome', 'patient')).text();
assert(summary.includes('does not prove a genetic variant'));
pass('hosted questionnaire renders non-diagnostic saved summary');
ok(await p.rpc('save_welcome_assessment', { p_answers: null }));
assert.equal(ok(await p.from('welcome_assessments').select('answers'))[0].answers, null);
pass('hosted skip clears saved answers');
const versions = [],
  sourcePaths = [];
const dates = ['2026-01-06', '2026-03-17', '2026-06-19', '2026-09-09'];
const values = ['0.90', '1.10', '1.40', '1.60'];
for (let i = 0; i < 4; i++) {
  const id = crypto.randomUUID(),
    path = `${users.patient.id}/${id}/source`,
    facility = [
      'Aster Grove Demo Hospital',
      'Beacon Vale Demo Diagnostics',
      'Cedar Bridge Demo Hospital',
      'Cedar Bridge Demo Hospital',
    ][i];
  sourcePaths.push(path);
  ok(
    await p.storage
      .from('health-records')
      .upload(path, syntheticPdf(dates[i], values[i], facility), {
        contentType: 'application/pdf',
        upsert: false,
      }),
  );
  ok(
    await p.rpc('create_draft', {
      p_id: id,
      p_record: null,
      p_title: `Synthetic release renal ${i + 1}`,
      p_kind: 'lab_report',
      p_date: dates[i],
      p_facility: facility,
      p_path: path,
      p_media: 'application/pdf',
    }),
  );
  versions.push(
    ok(
      await p.rpc('review_draft', {
        p_id: id,
        p_content: {
          notes: 'Fictional release test, not clinical care.',
          observations: [
            {
              label: 'Creatinine',
              value: values[i],
              unit: 'mg/dL',
              sourceExcerpt: `Serum creatinine: ${values[i]} mg/dL`,
              sourcePage: 1,
            },
          ],
        },
      }),
    ),
  );
}
pass('hosted private storage and review persist four fictional reports');
assert.equal(ok(await d.from('record_versions').select('id')).length, 0);
assert.equal(ok(await s.from('record_versions').select('id')).length, 0);
pass('doctor and wrong account denied before consent');
const grant = ok(
  await p.rpc('grant_records_with_analysis', {
    p_recipient: users.doctor.id,
    p_purpose: 'Synthetic release evidence verification',
    p_versions: versions,
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
assert.equal(ok(await d.from('record_versions').select('id')).length, 4);
pass('explicit hosted grant exposes exactly selected report versions');
const evidence = await page('/api/evidence', 'patient');
assert.equal(evidence.status, 200);
assert.equal(evidence.headers.get('cache-control'), 'private, no-store');
const body = await evidence.json();
assert(JSON.stringify(body).includes('77.8'));
pass('hosted evidence returns source-backed numerical change without caching');
const source = await page('/api/private-source/' + versions[0], 'doctor');
assert.equal(source.status, 200);
assert.equal(source.headers.get('cache-control'), 'private, no-store');
assert((await source.text()).startsWith('%PDF'));
assert.equal((await page('/api/private-source/' + versions[0], 'stranger')).status, 404);
pass('hosted server-only source delivery enforces consent and no-cache');
assert((await d.storage.from('health-records').createSignedUrl(sourcePaths[0], 60)).error);
pass('doctor cannot mint private storage URLs');
const invitation = ok(
  await p.rpc('create_family_invitation', {
    p_invitee: users.relative.id,
    p_relationship: 'father',
    p_basis: 'biological',
    p_adult: true,
  }),
);
ok(
  await r.rpc('accept_family_invitation', {
    p_id: invitation.id,
    p_token: invitation.token,
    p_adult: true,
  }),
);
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 0);
pass('family invitation acceptance does not disclose conditions');
const assertion = ok(
  await r.rpc('add_family_assertion', {
    p_condition: 'Type 2 diabetes',
    p_age: 48,
    p_source: null,
  }),
);
const share = ok(
  await r.rpc('share_family_assertion', {
    p_assertion: assertion,
    p_recipient: users.patient.id,
    p_purpose: 'Synthetic family context demonstration',
    p_expiry: new Date(Date.now() + 3600000).toISOString(),
  }),
);
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 1);
assert.equal(ok(await d.rpc('visible_family_assertions')).length, 0);
assert.equal(ok(await s.rpc('visible_family_assertions')).length, 0);
pass('independent family share excludes doctor and stranger');
ok(await r.rpc('revoke_family_share', { p_id: share }));
assert.equal(ok(await p.rpc('visible_family_assertions')).length, 0);
pass('hosted family revocation removes fresh visibility');
ok(await p.rpc('revoke_grant', { p_id: grant }));
assert.equal(ok(await d.from('record_versions').select('id')).length, 0);
assert.equal((await page('/api/private-source/' + versions[0], 'doctor')).status, 404);
pass('hosted record revocation blocks reads and private source');
assert.equal((await page('/api/evidence')).status, 401);
pass('anonymous hosted evidence request denied');
console.log(
  `Hosted synthetic release checks passed: ${count}. Synthetic credentials retained only in ignored local file.`,
);
