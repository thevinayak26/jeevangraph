import { DashboardImport } from './dashboard-import';
import Link from 'next/link';
import { requireSession } from '@/lib/supabase/server';
export async function PrivateHistorySummary() {
  const { db, user } = await requireSession();
  const { data, error } = await db
    .from('record_versions')
    .select('id,title,kind,clinical_date,facility')
    .eq('owner_id', user.id)
    .is('superseded_at', null)
    .order('clinical_date', { ascending: false, nullsFirst: false })
    .limit(100);
  if (error)
    return (
      <p role="alert">Your reviewed history could not load. Refresh or check your connection.</p>
    );
  const records = data ?? [];
  return (
    <section className="panel history-overview">
      <div className="history-overview-heading">
        <div>
          <h2>Your reviewed history</h2>
          <p>Only records you added and confirmed. Latest 100 current sources.</p>
        </div>
        <Link className="button primary" href="/secure/import">
          Add reports
        </Link>
      </div>
      <div className="history-metrics">
        <div>
          <strong>{records.length}</strong>
          <span>Reviewed reports</span>
        </div>
        <div>
          <strong>{new Set(records.map((r) => r.facility)).size}</strong>
          <span>Recorded facilities</span>
        </div>
        <div>
          <strong>{records.filter((r) => r.kind === 'prescription').length}</strong>
          <span>Prescriptions</span>
        </div>
        <div>
          <strong>{records.filter((r) => r.kind === 'lab_report').length}</strong>
          <span>Lab reports</span>
        </div>
      </div>
      {!records.length ? (
        <p>
          Your account starts empty. <Link href="/secure/import">Scan a synthetic report</Link>,
          review it and confirm it to populate this history.
        </p>
      ) : (
        <details open>
          <summary>My source timeline</summary>
          <ol className="private-timeline">
            {records.map((r) => (
              <li key={r.id}>
                <time>{r.clinical_date ?? 'Date unknown'}</time>
                <div>
                  <strong>{r.title}</strong>
                  <p>
                    {r.facility} · {r.kind.replaceAll('_', ' ')}
                  </p>
                  <a href={`/api/private-source/${r.id}`}>Open reviewed source</a>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
      <DashboardImport initialOpen={records.length === 0} />
      <Link href="/secure/chat">Ask a question about this history →</Link>
    </section>
  );
}
