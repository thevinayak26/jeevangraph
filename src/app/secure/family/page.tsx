import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isConnected, sessionClient } from '@/lib/supabase/server';
import { FamilyForm } from '@/components/family-form';
import {
  relationshipOptions,
  basisOptions,
  relationshipLabel,
  relativeToViewer,
  relationshipDegree,
  type FamilyLink,
  type FamilyAssertion,
  type ReportedHistory,
} from '@/lib/evidence';
export const dynamic = 'force-dynamic';
async function requestTime() {
  return Date.now();
}
function RelationshipFields() {
  return (
    <>
      <label>
        How is this person related to you?
        <select name="relationship">
          {relationshipOptions.map((r) => (
            <option key={r} value={r}>
              {relationshipLabel(r)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Relationship basis
        <select name="basis">
          {basisOptions.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
function ConditionFields() {
  return (
    <>
      <label>
        Condition as reported
        <input
          name="condition"
          maxLength={120}
          required
          placeholder="For example, type 2 diabetes"
        />
      </label>
      <label>
        Age at diagnosis (leave blank if unknown)
        <input name="age" type="number" min={0} max={120} />
      </label>
    </>
  );
}
export default async function FamilyPage() {
  if (!isConnected()) redirect('/account');
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/account');
  const results = await Promise.all([
    db
      .from('family_invitations')
      .select(
        'id,inviter_id,invitee_id,relationship,basis,expires_at,accepted_at,revoked_at,created_at',
      )
      .order('created_at', { ascending: false }),
    db.from('family_links').select('*').is('ended_at', null),
    db.from('family_assertions').select('*').is('withdrawn_at', null),
    db.from('family_assertion_shares').select('*').order('created_at', { ascending: false }),
    db.from('reported_family_history').select('*').is('withdrawn_at', null),
    db.from('record_versions').select('id,title').eq('owner_id', user.id).is('superseded_at', null),
    db.rpc('visible_family_assertions'),
  ]);
  type Invitation = {
    id: string;
    inviter_id: string;
    invitee_id: string;
    relationship: string;
    basis: string;
    expires_at: string;
    accepted_at: string | null;
    revoked_at: string | null;
  };
  type Share = {
    id: string;
    assertion_id: string;
    owner_id: string;
    recipient_id: string;
    purpose: string;
    expires_at: string;
    revoked_at: string | null;
    link_id: string;
  };
  const invitations = (results[0].data ?? []) as Invitation[];
  const links = (results[1].data ?? []) as FamilyLink[];
  const assertions = (results[2].data ?? []) as FamilyAssertion[];
  const shares = (results[3].data ?? []) as Share[];
  const reported = (results[4].data ?? []) as ReportedHistory[];
  const sources = (results[5].data ?? []) as { id: string; title: string }[];
  const visible = (results[6].data ?? []) as FamilyAssertion[];
  const current = new Set(
    visible
      .filter((a: { owner_id: string }) => a.owner_id === user.id)
      .map((a: { id: string }) => a.id),
  );
  const activeAssertions = assertions.filter((a) => current.has(a.id));
  const visibleIds = new Set(visible.map((a) => a.id));
  const linkIds = new Set(links.map((l) => l.id));
  const now = await requestTime();
  return (
    <main className="secure-shell phase3-shell">
      <nav className="phase3-nav" aria-label="Private workspace">
        <Link href="/secure">Private records</Link>
        <Link href="/secure/import">Scan &amp; import</Link>
        <Link href="/secure/chat">Ask my history</Link>
        <Link href="/secure/welcome">Health questionnaire</Link>
        <Link href="/secure/intelligence">Evidence & HealthGraph</Link>
        <Link href="/secure/family" aria-current="page">
          Family history
        </Link>
      </nav>
      <h1>Family connection, individual control</h1>
      <p className="phase3-lead">
        Report what you know, invite an adult relative, and share only what each person explicitly
        chooses. Family history is context, not genetic proof or a diagnosis for you.
      </p>
      <p>
        Your account ID: <code>{user.id}</code>
      </p>
      <p className="phase3-notice">
        This flow is for self-attested adult accounts. It does not verify biological relationships
        or establish guardian access to a child’s records. A family link never grants chart access
        or onward sharing to a doctor.
      </p>
      {results.some((r) => r.error) && (
        <p role="alert">
          Family data could not load. Apply the Phase 3 migration and refresh this page before
          continuing.
        </p>
      )}
      <div className="secure-grid">
        <section className="panel">
          <h2>What you know about your family</h2>
          <p>
            Record family context even if a relative has no account. It stays labeled
            patient-reported and is private to your account.
          </p>
          <FamilyForm intent="reported" button="Save reported family history">
            <RelationshipFields />
            <ConditionFields />
          </FamilyForm>
          {reported.map((h) => (
            <article key={h.id}>
              <h3>
                {relationshipLabel(h.relationship)}: {h.condition}
              </h3>
              <p>
                {h.basis}.{' '}
                {relationshipDegree(h.relationship, h.basis)
                  ? `Biological degree: ${relationshipDegree(h.relationship, h.basis)}.`
                  : 'No biological degree asserted.'}{' '}
                Age at diagnosis: {h.age_at_diagnosis ?? 'unknown'}. Patient-reported; not
                independently confirmed.
              </p>
              <FamilyForm intent="withdraw_reported" button="Withdraw this entry" secondary>
                <input type="hidden" name="id" value={h.id} />
              </FamilyForm>
            </article>
          ))}
        </section>
        <section className="panel">
          <h2>Invite an adult relative</h2>
          <p>
            Use their exact JeevanGraph account ID. Share the one-time invitation details yourself;
            no email or message is sent.
          </p>
          <FamilyForm intent="invite" button="Create private invitation">
            <label>
              Relative account ID
              <input name="recipient" required />
            </label>
            <RelationshipFields />
            <label>
              <input type="checkbox" name="adult" value="yes" required /> I am an adult and this
              invitation is for another adult. The relationship description is self-attested.
            </label>
          </FamilyForm>
        </section>
        <section className="panel">
          <h2>Accept a relationship invitation</h2>
          <p>
            Review the relationship and account details in the invitations list below. Acceptance
            links the accounts only; it does not share conditions or reports.
          </p>
          <FamilyForm intent="accept" button="Accept relationship only">
            <label>
              Invitation ID
              <input name="id" required />
            </label>
            <label>
              One-time secret
              <input name="token" autoComplete="off" required minLength={64} maxLength={64} />
            </label>
            <label>
              <input type="checkbox" name="adult" value="yes" required /> I am an adult and accept
              the self-attested relationship shown in this invitation.
            </label>
          </FamilyForm>
        </section>
        <section className="panel">
          <h2>My own medical history</h2>
          <p>
            Create a condition entry about yourself before choosing whether to share it. A linked
            document supports provenance; its clinical meaning is not independently verified.
          </p>
          <FamilyForm intent="assertion" button="Save my condition">
            <ConditionFields />
            <label>
              Supporting source (optional, remains private)
              <select name="source">
                <option value="">Self-reported, no source linked</option>
                {sources.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </label>
          </FamilyForm>
          {assertions.map((a) => (
            <article key={a.id}>
              <h3>{a.condition}</h3>
              <p>
                Age at diagnosis: {a.age_at_diagnosis ?? 'unknown'}.{' '}
                {a.source_kind.replaceAll('_', ' ')}.
              </p>
              {!current.has(a.id) && (
                <p>
                  Supporting source was superseded. This entry is excluded from fresh shared
                  evidence until you create a corrected entry.
                </p>
              )}
              <FamilyForm intent="withdraw_assertion" button="Withdraw this condition" secondary>
                <input name="id" type="hidden" value={a.id} />
              </FamilyForm>
            </article>
          ))}
        </section>
        <section className="panel">
          <h2>Share one condition with a relative</h2>
          <p>
            Acceptance is required first. This shares the selected condition and age, not its
            supporting report or your other records.
          </p>
          <FamilyForm intent="share" button="Share selected condition">
            <label>
              My condition
              <select name="assertion" required>
                <option value="">Choose one</option>
                {activeAssertions.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.condition}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Named relative
              <select name="recipient" required>
                <option value="">Choose an accepted relative</option>
                {links.map((l: FamilyLink) => {
                  const other = l.inviter_id === user.id ? l.invitee_id : l.inviter_id;
                  return (
                    <option key={l.id} value={other}>
                      {relationshipLabel(relativeToViewer(l, user.id))}: {other}
                    </option>
                  );
                })}
              </select>
            </label>
            <label>
              Purpose
              <input
                name="purpose"
                required
                minLength={5}
                maxLength={200}
                placeholder="Family-history discussion"
              />
            </label>
            <label>
              Expires after hours
              <input name="hours" type="number" min={1} max={720} defaultValue={24} required />
            </label>
            <label>
              <input name="confirmed" type="checkbox" value="yes" required /> Share only this
              assertion with this relative for this purpose and duration. No onward doctor access is
              granted.
            </label>
          </FamilyForm>
        </section>
        <section className="panel">
          <h2>Accepted relationships</h2>
          {!links.length && (
            <p>No accepted relationships. Invitations alone do not create a link.</p>
          )}
          {links.map((l: FamilyLink) => (
            <article key={l.id}>
              <h3>{relationshipLabel(relativeToViewer(l, user.id))}</h3>
              <p>
                {l.basis} relationship. Account:{' '}
                <code>{l.inviter_id === user.id ? l.invitee_id : l.inviter_id}</code>
              </p>
              <FamilyForm intent="unlink" button="End relationship and future sharing" secondary>
                <input type="hidden" name="id" value={l.id} />
              </FamilyForm>
            </article>
          ))}
          <p>
            <Link href="/secure/intelligence">
              View currently visible family context in HealthGraph
            </Link>
          </p>
        </section>
      </div>
      <section className="panel">
        <h2>Invitation receipts</h2>
        {!invitations.length && <p>No invitations.</p>}
        {invitations.map((i) => (
          <article key={i.id}>
            <h3>
              {relationshipLabel(i.relationship)} · {i.basis}
            </h3>
            <p>
              Relationship description is relative to inviter <code>{i.inviter_id}</code>.
            </p>
            <p>
              Named recipient: <code>{i.invitee_id}</code>
            </p>
            <p>
              Invitation: <code>{i.id}</code>. Expires: {i.expires_at}.{' '}
              {i.accepted_at
                ? 'Accepted'
                : i.revoked_at
                  ? 'Revoked'
                  : Date.parse(i.expires_at) <= now
                    ? 'Expired'
                    : 'Pending'}
            </p>
            {i.inviter_id === user.id && !i.accepted_at && !i.revoked_at && (
              <FamilyForm intent="revoke_invite" button="Revoke invitation" secondary>
                <input type="hidden" name="id" value={i.id} />
              </FamilyForm>
            )}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Condition-sharing receipts</h2>
        <p>
          Revocation, withdrawal, expiry, source correction or ending the relationship removes the
          assertion from fresh evidence views. Already viewed information cannot be erased from
          another person’s memory or copies.
        </p>
        {!shares.length && <p>No conditions shared.</p>}
        {shares.map((s) => (
          <article key={s.id}>
            <p>
              Condition entry: <code>{s.assertion_id}</code>. Recipient:{' '}
              <code>{s.recipient_id}</code>
            </p>
            <p>
              Purpose: {s.purpose}. Expires: {s.expires_at}.{' '}
              {s.revoked_at
                ? 'Revoked'
                : Date.parse(s.expires_at) <= now
                  ? 'Expired'
                  : !linkIds.has(s.link_id)
                    ? 'Relationship ended'
                    : !visibleIds.has(s.assertion_id)
                      ? 'Entry withdrawn or supporting source changed'
                      : 'Active'}
            </p>
            {s.owner_id === user.id && !s.revoked_at && (
              <FamilyForm intent="revoke_share" button="Revoke condition sharing" secondary>
                <input name="id" type="hidden" value={s.id} />
              </FamilyForm>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
