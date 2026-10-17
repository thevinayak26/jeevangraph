import Link from 'next/link';
import { isConnected } from '@/lib/supabase/server';
import { authenticate } from './actions';
export const dynamic = 'force-dynamic';
export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return (
    <main className="secure-shell">
      <Link href="/patient/overview">JeevanGraph · Preview</Link>
      <h1>Your private health workspace</h1>
      <p>
        Synthetic test documents only. Your account does not inherit a role from the preview
        selector.
      </p>
      {!isConnected() ? (
        <section className="panel">
          <h2>Connection setup required</h2>
          <p>
            Configure Supabase and apply the Phase 2 migration before creating accounts. See
            docs/PHASE_2_SETUP.md.
          </p>
        </section>
      ) : (
        <section className="panel">
          {status && (
            <p role="status">
              {status === 'confirm'
                ? 'Check your email to confirm your account, then sign in.'
                : 'Unable to sign in or create an account. Check your details and try again.'}
            </p>
          )}
          <form action={authenticate}>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Password (12+ characters)
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button primary" name="mode" value="login">
              Sign in
            </button>
            <button className="button secondary" name="mode" value="signup">
              Create patient account
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
