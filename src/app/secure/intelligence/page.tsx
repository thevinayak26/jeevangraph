import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isConnected, sessionClient } from '@/lib/supabase/server';
import { EvidenceWorkspace } from '@/components/evidence-workspace';
import { DemoExplanation } from '@/components/demo-explanation';
import { PrivateHistorySummary } from '@/components/private-history-summary';
export const dynamic = 'force-dynamic';
export default async function Intelligence() {
  if (!isConnected()) redirect('/account');
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/account');
  return (
    <main className="secure-shell phase3-shell">
      <nav className="phase3-nav" aria-label="Private workspace">
        <Link href="/secure">Private records</Link>
        <Link href="/secure/welcome">Health questionnaire</Link>
        <Link href="/secure/import">Scan &amp; import</Link>
        <Link href="/secure/chat">Ask my history</Link>
        <Link href="/secure/intelligence" aria-current="page">
          Evidence & HealthGraph
        </Link>
        <Link href="/secure/family">Family history</Link>
      </nav>
      <h1>Connect the evidence</h1>
      <p className="phase3-lead">
        See documented changes, trace their sources and explore relationships. Available history
        only; synthetic test documents only.
      </p>
      <PrivateHistorySummary />
      <EvidenceWorkspace />
      <details className="panel">
        <summary>Separate bundled example, outside your personal history</summary>
        <DemoExplanation />
      </details>
    </main>
  );
}
