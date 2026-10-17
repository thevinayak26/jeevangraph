'use server';
import { requireSession } from '@/lib/supabase/server';
import { explainBundledDemo, type Explanation } from '@/lib/demo-explanation';
// Local guard supplements provider quota controls; it is not a distributed billing guarantee.
const lastRequest = new Map<string, number>();
export async function requestDemoExplanation(
  _previous: Explanation | null,
  form: FormData,
): Promise<Explanation> {
  const session = await requireSession().catch(() => null);
  if (!session) return explainBundledDemo({ enabled: false });
  const { user } = session;
  const enabled =
    process.env.AI_PROVIDER === 'gemini' &&
    process.env.ALLOW_EXTERNAL_AI_FOR_BUNDLED_FIXTURES === 'true' &&
    form.get('confirmed') === 'yes';
  if (enabled) {
    const now = Date.now();
    const last = lastRequest.get(user.id) ?? 0;
    if (now - last < 60000) return explainBundledDemo({ enabled: false });
    if (lastRequest.size > 1000) lastRequest.clear();
    lastRequest.set(user.id, now);
  }
  return explainBundledDemo({
    enabled,
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL ?? 'gemini-3.5-flash-lite',
  });
}
