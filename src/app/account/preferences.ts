'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
export async function setQuestionnaireDemoMode(form: FormData) {
  const jar = await cookies();
  jar.set('jg_skip_questionnaire', form.get('skip_questionnaire') === 'yes' ? '1' : '0', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.VERCEL === '1',
    path: '/',
  });
  redirect('/secure');
}
