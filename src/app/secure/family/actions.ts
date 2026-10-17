'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession } from '@/lib/supabase/server';
import { relationshipOptions, basisOptions } from '@/lib/evidence';
export type FamilyActionState = {
  message: string;
  invitation?: { id: string; token: string; expires_in_hours: number };
};
const id = z.uuid();
const relation = z.enum(relationshipOptions);
const basis = z.enum(basisOptions);
function text(f: FormData, key: string) {
  return String(f.get(key) ?? '');
}
function age(f: FormData) {
  const v = text(f, 'age');
  return v === '' ? null : z.coerce.number().int().min(0).max(120).parse(v);
}
export async function familyAction(
  _previous: FamilyActionState,
  form: FormData,
): Promise<FamilyActionState> {
  try {
    const { db } = await requireSession();
    const intent = text(form, 'intent');
    let rpc = '';
    let args: Record<string, unknown> = {};
    switch (intent) {
      case 'invite':
        rpc = 'create_family_invitation';
        args = {
          p_invitee: id.parse(text(form, 'recipient')),
          p_relationship: relation.parse(text(form, 'relationship')),
          p_basis: basis.parse(text(form, 'basis')),
          p_adult: form.get('adult') === 'yes',
        };
        break;
      case 'accept':
        rpc = 'accept_family_invitation';
        args = {
          p_id: id.parse(text(form, 'id')),
          p_token: z
            .string()
            .regex(/^[a-f0-9]{64}$/)
            .parse(text(form, 'token')),
          p_adult: form.get('adult') === 'yes',
        };
        break;
      case 'revoke_invite':
        rpc = 'revoke_family_invitation';
        args = { p_id: id.parse(text(form, 'id')) };
        break;
      case 'unlink':
        rpc = 'end_family_link';
        args = { p_id: id.parse(text(form, 'id')) };
        break;
      case 'assertion':
        rpc = 'add_family_assertion';
        args = {
          p_condition: z.string().trim().min(1).max(120).parse(text(form, 'condition')),
          p_age: age(form),
          p_source: text(form, 'source') ? id.parse(text(form, 'source')) : null,
        };
        break;
      case 'withdraw_assertion':
        rpc = 'withdraw_family_assertion';
        args = { p_id: id.parse(text(form, 'id')) };
        break;
      case 'share': {
        if (form.get('confirmed') !== 'yes') throw new Error('Explicit sharing consent required');
        const hours = z.coerce.number().int().min(1).max(720).parse(text(form, 'hours'));
        rpc = 'share_family_assertion';
        args = {
          p_assertion: id.parse(text(form, 'assertion')),
          p_recipient: id.parse(text(form, 'recipient')),
          p_purpose: z.string().trim().min(5).max(200).parse(text(form, 'purpose')),
          p_expiry: new Date(Date.now() + hours * 3600000).toISOString(),
        };
        break;
      }
      case 'revoke_share':
        rpc = 'revoke_family_share';
        args = { p_id: id.parse(text(form, 'id')) };
        break;
      case 'reported':
        rpc = 'add_reported_family_history';
        args = {
          p_relationship: relation.parse(text(form, 'relationship')),
          p_basis: basis.parse(text(form, 'basis')),
          p_condition: z.string().trim().min(1).max(120).parse(text(form, 'condition')),
          p_age: age(form),
        };
        break;
      case 'withdraw_reported':
        rpc = 'withdraw_reported_family_history';
        args = { p_id: id.parse(text(form, 'id')) };
        break;
      default:
        throw new Error('Unknown action');
    }
    const { data, error } = await db.rpc(rpc, args);
    if (error) throw error;
    revalidatePath('/secure/family');
    revalidatePath('/secure/intelligence');
    return {
      message:
        intent === 'invite'
          ? 'Invitation created. Copy the secret now; it is shown only in this response. Accepting it will not share medical history.'
          : 'Saved. Fresh evidence views will recheck these permissions.',
      ...(intent === 'invite' ? { invitation: data } : {}),
    };
  } catch {
    return {
      message:
        'Could not save. Check the account IDs, required approvals, invitation validity and sharing permissions, then try again.',
    };
  }
}
