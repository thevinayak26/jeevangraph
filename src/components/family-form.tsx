'use client';
import { useActionState, type ReactNode } from 'react';
import { familyAction } from '@/app/secure/family/actions';
export function FamilyForm({
  intent,
  children,
  button,
  secondary = false,
}: {
  intent: string;
  children?: ReactNode;
  button: string;
  secondary?: boolean;
}) {
  const [state, action, pending] = useActionState(familyAction, { message: '' });
  return (
    <form action={action}>
      <input type="hidden" name="intent" value={intent} />
      {children}
      <button className={`button ${secondary ? 'secondary' : 'primary'}`} disabled={pending}>
        {pending ? 'Saving…' : button}
      </button>
      {state.message && <p role="status">{state.message}</p>}
      {state.invitation && (
        <div className="phase3-invitation">
          <p>
            Send these details privately to the named relative. No message has been sent
            automatically.
          </p>
          <p>
            Invitation ID: <code>{state.invitation.id}</code>
          </p>
          <p>
            One-time secret: <code>{state.invitation.token}</code>
          </p>
          <p>
            Expires in {state.invitation.expires_in_hours} hours. This secret is not included in
            URLs or saved in plaintext in the database.
          </p>
        </div>
      )}
    </form>
  );
}
