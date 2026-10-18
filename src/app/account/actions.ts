'use server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { sessionClient } from '@/lib/supabase/server';
export async function authenticate(f: FormData) {
  let target = '/account?status=failed';
  try {
    const db = await sessionClient();
    const email = z.email().max(254).parse(f.get('email'));
    const password = z.string().min(12).max(128).parse(f.get('password'));
    const signup = f.get('mode') === 'signup';
    const siteOrigin = process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL
      : 'http://127.0.0.1:3102';
    const { data, error } = signup
      ? await db.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: siteOrigin + '/auth/callback' },
        })
      : await db.auth.signInWithPassword({ email, password });
    if (!error) {
      const jar = await cookies();
      jar.set('jg_skip_questionnaire', f.get('skip_questionnaire') === 'yes' ? '1' : '0', {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.VERCEL === '1',
        path: '/',
      });
      target = data.session
        ? f.get('skip_questionnaire') === 'yes'
          ? '/secure/intelligence'
          : '/secure'
        : '/account?status=confirm';
    }
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
