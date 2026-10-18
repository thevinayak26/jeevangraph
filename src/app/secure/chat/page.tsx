import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isConnected, sessionClient } from '@/lib/supabase/server';
import { HistoryChat } from '@/components/history-chat';
export const dynamic = 'force-dynamic';
export default async function ChatPage() {
  if (!isConnected()) redirect('/account');
  const db = await sessionClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect('/account');
  return (
    <main className="secure-shell chat-shell">
      <nav className="phase3-nav" aria-label="Private workspace">
        <Link href="/secure">Private records</Link>
        <Link href="/secure/import">Scan & import</Link>
        <Link href="/secure/intelligence">HealthGraph</Link>
        <Link href="/secure/chat" aria-current="page">
          Ask my history
        </Link>
        <Link href="/secure/family">Family history</Link>
      </nav>
      <HistoryChat
        cloudAvailable={
          process.env.ALLOW_EXTERNAL_AI_FOR_SYNTHETIC_CHAT === 'true' &&
          Boolean(process.env.GEMINI_API_KEY)
        }
      />
    </main>
  );
}
