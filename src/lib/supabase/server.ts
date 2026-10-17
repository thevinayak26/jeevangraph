import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export function isConnected() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
export async function sessionClient() {
  if (!isConnected()) throw new Error('Supabase is not configured');
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Proxy refreshes cookies during page rendering. */
          }
        },
      },
    },
  );
}
export async function requireSession() {
  const db = await sessionClient();
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) throw new Error('Sign in required');
  return { db, user: data.user };
}
