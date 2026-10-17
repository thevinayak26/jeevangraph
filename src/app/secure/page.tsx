import Link from 'next/link';
import { ReviewFields } from '@/components/review-fields';
import { redirect } from 'next/navigation';
import { isConnected, sessionClient } from '@/lib/supabase/server';
import { signOut } from '@/app/account/actions';
import {
  uploadRecord,
  reviewRecord,
  grantRecords,
  revokeGrant,
  authorizeIngestion,
  revokeIngestion,
  simulateIngestion,
} from './actions';
export const dynamic = 'force-dynamic';
async function requestTime() {
  return Date.now();
}
export default async function Secure({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!isConnected()) redirect('/account');
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/account');
  const results = await Promise.all([
    db.from('record_versions').select('*').order('reviewed_at', { ascending: false }),
    db.from('record_drafts').select('*').eq('status', 'pending'),
    db.from('consent_grants').select('*').order('created_at', { ascending: false }),
    db.from('memberships').select('role,organization,active').eq('active', true),
    db.from('ingestion_tickets').select('*').order('created_at', { ascending: false }),
    db
      .from('audit_events')
      .select('event,resource_id,created_at')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);
  const [versions, drafts, grants, memberships, tickets, audit] = results.map((r) => r.data ?? []);
  const owned = versions.filter((v) => v.owner_id === user.id);
  const status = (await searchParams).status;
  const now = await requestTime();
  return (
    <main className="secure-shell">
      <header>
        <Link href="/patient/overview">JeevanGraph · Synthetic preview</Link>
        <form action={signOut}>
          <button className="button secondary">Sign out</button>
        </form>
      </header>
      <nav className="phase3-nav" aria-label="Private workspace">
        <Link href="/secure" aria-current="page">
          Private records
        </Link>
        <Link href="/secure/intelligence">Evidence &amp; HealthGraph</Link>
        <Link href="/secure/family">Family history</Link>
      </nav>
      <h1>Your private records</h1>
      <p>
        Signed in as {user.email}. Account ID: <code>{user.id}</code>
      </p>
      <p>
        Synthetic test documents only. Explore evidence and separately consented family context
        using the private workspace links. Clinical AI is not enabled on your uploads.
      </p>
      {status && (
        <p role="status">
          {status === 'saved'
            ? 'Saved successfully.'
            : 'Could not save. Check permissions, inputs, expiry and connection, then try again.'}
        </p>
      )}
      {results.some((r) => r.error) && (
        <p role="alert">
          Some data could not load. Apply the database migration and verify connection setup.
        </p>
      )}
      <div className="secure-grid">
        <section className="panel">
          <h2>1. Add a source report</h2>
          <p>PDF, PNG or JPEG, up to 5 MB. Manual review required. No automatic OCR is claimed.</p>
          <form action={uploadRecord}>
            <label>
              Report title
              <input name="title" required maxLength={160} />
            </label>
            <label>
              Facility
              <input name="facility" required maxLength={160} />
            </label>
            <label>
              Record type
              <select name="kind">
                <option value="lab_report">Lab report</option>
                <option value="prescription">Prescription</option>
                <option value="imaging_report">Imaging report</option>
                <option value="immunization">Immunization</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label>
              Report date (leave blank if unknown)
              <input name="date" type="date" />
            </label>
            <label>
              Correction of an existing record
              <select name="record">
                <option value="">New record</option>
                {Array.from(new Map(owned.map((v) => [v.record_id, v])).values()).map((v) => (
                  <option key={v.record_id} value={v.record_id}>
                    {v.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source file
              <input
                name="file"
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                required
              />
            </label>
            <button className="button primary">Upload for review</button>
          </form>
        </section>
        <section className="panel">
          <h2>2. Review pending reports</h2>
          {!drafts.length && <p>No reports awaiting review.</p>}
          {drafts.map((d) => (
            <article key={d.id}>
              <h3>{d.title}</h3>
              <p>
                {d.facility} · {d.clinical_date ?? 'Date unknown'}
              </p>
              <p>
                {d.object_path ? (
                  <a href={`/api/private-source/${d.id}?draft=1`}>Download source to review</a>
                ) : (
                  'Simulated facility submission, not an original scanned report'
                )}
              </p>
              <form action={reviewRecord}>
                <input type="hidden" name="id" value={d.id} />
                <ReviewFields initial={d.extracted} />
                <p>
                  Compare each measurement with the source. Keep uncertain information in notes.
                </p>
                <label>
                  <input type="checkbox" name="confirmed" value="yes" required /> I reviewed the
                  source and these fields.
                </label>
                <button className="button primary">Publish immutable version</button>
              </form>
            </article>
          ))}
        </section>
        <section className="panel">
          <h2>3. Share exact versions</h2>
          <p>
            Named approved doctor, stated purpose, maximum 30 days. Numerical analysis requires
            separate permission. Corrections require a new grant. Revocation cannot retract
            downloaded copies.
          </p>
          <form action={grantRecords}>
            <label>
              Doctor account ID
              <input name="recipient" required />
            </label>
            <label>
              Purpose
              <input name="purpose" minLength={5} maxLength={200} required />
            </label>
            <label>
              Expires after hours
              <input name="hours" type="number" min={1} max={720} defaultValue={24} required />
            </label>
            {owned.map((v) => (
              <label key={v.id}>
                <input name="versions" type="checkbox" value={v.id} />
                {v.title} · {v.id.slice(0, 8)} · {v.clinical_date ?? 'Date unknown'}
              </label>
            ))}
            <label>
              <input type="checkbox" name="analysis" value="yes" /> Also allow numerical trends and
              the evidence graph for these selected versions. This does not allow cloud AI
              processing.
            </label>
            <label>
              <input type="checkbox" name="confirmed" value="yes" required /> I authorize this
              doctor to read only the checked versions for this purpose and duration.
            </label>
            <button className="button primary">Grant access</button>
          </form>
        </section>
        <section className="panel">
          <h2>Consent receipts</h2>
          {!grants.length && <p>No grants.</p>}
          {grants.map((g) => (
            <article key={g.id}>
              <p>
                Recipient: <code>{g.recipient_id}</code>
              </p>
              <p>
                Purpose: {g.purpose} ·{' '}
                {g.action === 'read_analyze' ? 'Read and numerical analysis' : 'Read only'}
              </p>
              <p>
                {g.version_ids.length} exact versions · Expires {g.expires_at}
              </p>
              <p>
                {g.revoked_at ? 'Revoked' : Date.parse(g.expires_at) <= now ? 'Expired' : 'Active'}
              </p>
              {g.owner_id === user.id && !g.revoked_at && (
                <form action={revokeGrant}>
                  <input type="hidden" name="id" value={g.id} />
                  <button className="button secondary">Revoke future access</button>
                </form>
              )}
            </article>
          ))}
        </section>
      </div>
      <section className="panel">
        <h2>Available reviewed records</h2>
        <p>
          Includes your versions and versions currently shared with your approved doctor account.
          Facility/platform memberships do not grant chart access.
        </p>
        {!versions.length && <p>No records available.</p>}
        {versions.map((v) => (
          <article key={v.id}>
            <h3>{v.title}</h3>
            <p>
              {v.facility} · {v.clinical_date ?? 'Date unknown'} · Version {v.id.slice(0, 8)}
            </p>
            <p>{v.content.notes}</p>
            <div className="secure-measurements">
              {v.content.observations.map(
                (
                  o: {
                    label: string;
                    value: string;
                    unit: string;
                    sourceExcerpt: string;
                    sourcePage: number;
                  },
                  i: number,
                ) => (
                  <div key={i}>
                    <strong>
                      {o.label}: {o.value} {o.unit}
                    </strong>
                    <p>
                      Source page {o.sourcePage}: {o.sourceExcerpt}
                    </p>
                  </div>
                ),
              )}
            </div>
            {v.object_path && <a href={`/api/private-source/${v.id}`}>Download original source</a>}
          </article>
        ))}
      </section>
      <section className="panel">
        <h2>Authorize one simulated facility delivery</h2>
        <p>
          One named facility account, one hour, one submission. Delivery does not grant access to
          your history. Share the ticket ID privately with the facility operator.
        </p>
        <form action={authorizeIngestion}>
          <label>
            Facility account ID
            <input name="recipient" required />
          </label>
          <label>
            Exact organization name
            <input name="organization" required maxLength={160} />
          </label>
          <label>
            <input name="confirmed" type="checkbox" value="yes" required /> Allow this facility to
            submit one synthetic report for my review.
          </label>
          <button className="button primary">Authorize delivery</button>
        </form>
        {tickets.map((t) => (
          <article key={t.id}>
            <code>{t.id}</code>
            <p>
              {t.organization} ·{' '}
              {t.used_at
                ? 'Used'
                : t.revoked_at
                  ? 'Revoked'
                  : Date.parse(t.expires_at) <= now
                    ? 'Expired'
                    : 'Pending'}{' '}
              · Expires {t.expires_at}
            </p>
            {!t.used_at && !t.revoked_at && (
              <form action={revokeIngestion}>
                <input name="id" type="hidden" value={t.id} />
                <button className="button secondary">Cancel delivery permission</button>
              </form>
            )}
          </article>
        ))}
      </section>
      {memberships.some((m) => m.role === 'facility') && (
        <section className="panel">
          <h2>Facility simulator</h2>
          <p>
            Use the same request key and unchanged payload to retry a submission safely. A changed
            replay is rejected.
          </p>
          <form action={simulateIngestion}>
            <label>
              Patient-authorized ticket ID
              <input name="ticket" required />
            </label>
            <label>
              Idempotency UUID
              <input name="key" defaultValue={crypto.randomUUID()} required />
            </label>
            <label>
              Report title
              <input name="title" required maxLength={160} />
            </label>
            <label>
              Report date
              <input name="date" type="date" required />
            </label>
            <ReviewFields />
            <button className="button primary">Submit synthetic report</button>
          </form>
        </section>
      )}
      <section className="panel">
        <h2>Your audit history</h2>
        <p>
          Event labels and resource IDs only. Direct database reads are protected by RLS but are not
          individually logged here.
        </p>
        {audit.map((a, i) => (
          <p key={i}>
            {a.created_at} · {a.event} · <code>{a.resource_id}</code>
          </p>
        ))}
      </section>
    </main>
  );
}
