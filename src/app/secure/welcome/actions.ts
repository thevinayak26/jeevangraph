'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/supabase/server';
import { assessmentSchema } from '@/lib/assessment';
export async function saveAssessment(form: FormData) {
  let target = '/secure/welcome?status=failed';
  try {
    const { db } = await requireSession();
    const intent = form.get('intent');
    if (intent === 'clear') {
      const { error } = await db.rpc('clear_welcome_assessment');
      if (!error) target = '/secure/welcome?status=cleared';
    } else if (intent === 'skip') {
      const { error } = await db.rpc('save_welcome_assessment', { p_answers: null });
      if (!error) target = '/secure';
    } else if (intent === 'save' && form.get('consent') === 'yes') {
      const age = form.get('age_at_diagnosis');
      const answers = assessmentSchema.parse({
        region: form.get('region'),
        environment: form.get('environment'),
        allergies: form.getAll('allergies'),
        conditions: form.getAll('conditions'),
        exposure: form.get('exposure'),
        family_condition: form.get('family_condition'),
        relationship: form.get('relationship'),
        basis: form.get('basis'),
        age_at_diagnosis: age ? Number(age) : null,
      });
      const { error } = await db.rpc('save_welcome_assessment', {
        p_answers: { ...answers, schema_version: 1 },
      });
      if (!error) target = '/secure/welcome?status=saved';
    }
    revalidatePath('/secure');
    revalidatePath('/secure/welcome');
  } catch {
    /* No health answers in logs or URLs. */
  }
  redirect(target);
}
