import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/supabase/server';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get('code');
  if (code && code.length < 2048) {
    try {
      const db = await sessionClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error)
        return NextResponse.redirect(new URL('/secure', request.url), {
          headers: { 'Cache-Control': 'private, no-store' },
        });
    } catch {
      /* Invalid or expired confirmation. */
    }
  }
  return NextResponse.redirect(new URL('/account?status=confirm_failed', request.url), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
