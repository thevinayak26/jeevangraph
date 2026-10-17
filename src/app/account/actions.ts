'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sessionClient } from '@/lib/supabase/server';
export async function authenticate(f: FormData) {
  let target = '/account?status=failed';
  try {
    const db = await sessionClient();
    const email = z.email().max(254).parse(f.get('email'));
    const password = z.string().min(12).max(128).parse(f.get('password'));
    const signup = f.get('mode') === 'signup';
    const { data, error } = signup
      ? await db.auth.signUp({ email, password })
      : await db.auth.signInWithPassword({ email, password });
    if (!error) target = data.session ? '/secure' : '/account?status=confirm';
  } catch {
    /* Generic failure avoids account enumeration. */
  }
  redirect(target);
}
export async function signOut() {
  const db = await sessionClient();
  await db.auth.signOut();
  redirect('/account');
}
