import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isConnected, sessionClient } from '@/lib/supabase/server';
import { ScanWorkspace } from '@/components/scan-workspace';
export const dynamic = 'force-dynamic';
export default async function ImportPage() {
  if (!isConnected()) redirect('/account');
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/account');
  return (
    <main className="secure-shell scan-shell">
      <nav className="phase3-nav" aria-label="Private workspace">
        <Link href="/secure">Private records</Link>
        <Link href="/secure/import" aria-current="page">
          Scan & import
        </Link>
        <Link href="/secure/intelligence">HealthGraph</Link>
        <Link href="/secure/chat">Ask my history</Link>
        <Link href="/secure/family">Family history</Link>
      </nav>
      <ScanWorkspace />
    </main>
  );
}
