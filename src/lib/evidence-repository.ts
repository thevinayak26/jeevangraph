import 'server-only';
import { requireSession } from './supabase/server';
import {
  buildEvidence,
  type EvidenceVersion,
  type FamilyLink,
  type FamilyAssertion,
  type ReportedHistory,
} from './evidence';
export async function authorizedEvidence() {
  const { db, user } = await requireSession();
  const results = await Promise.all([
    db.rpc('authorized_analysis_versions'),
    db
      .from('family_links')
      .select('id,inviter_id,invitee_id,relationship,basis,ended_at')
      .is('ended_at', null),
    db.rpc('visible_family_assertions'),
    db
      .from('reported_family_history')
      .select('id,owner_id,relationship,basis,condition,age_at_diagnosis,withdrawn_at')
      .is('withdrawn_at', null),
  ]);
  if (results.some((r) => r.error)) throw new Error('Authorized evidence could not be loaded');
  return buildEvidence(
    results[0].data as EvidenceVersion[],
    user.id,
    results[1].data as FamilyLink[],
    results[2].data as FamilyAssertion[],
    results[3].data as ReportedHistory[],
  );
}
