import { z } from 'zod';
import { requireSession } from '@/lib/supabase/server';
import { buildEvidence, type EvidenceVersion } from '@/lib/evidence';
import { answerHistory, restrictedQuestion } from '@/lib/history-chat';
import { routeSyntheticQuestion } from '@/lib/chat-router';
export const dynamic = 'force-dynamic';
const recent = new Map<string, number>();
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const { db, user } = await requireSession();
    if (Number(request.headers.get('content-length')) > 6000)
      return Response.json({ error: 'Question too long.' }, { status: 413, headers });
    const reader = request.body?.getReader();
    if (!reader) throw new Error('Question required');
    let raw = '',
      size = 0;
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 6000) {
        await reader.cancel();
        return Response.json({ error: 'Question too long.' }, { status: 413, headers });
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    const input = z
      .object({ question: z.string().trim().min(2).max(800), cloud: z.boolean().default(false) })
      .strict()
      .parse(JSON.parse(raw));
    const { data, error } = await db
      .from('record_versions')
      .select(
        'id,record_id,owner_id,title,kind,clinical_date,facility,reviewed_at,superseded_at,content',
      )
      .eq('owner_id', user.id)
      .is('superseded_at', null)
      .order('clinical_date', { ascending: false, nullsFirst: false })
      .limit(100);
    if (error) throw error;
    const records = data as EvidenceVersion[],
      projection = buildEvidence(records, user.id, [], [], []);
    const allowCloud =
      input.cloud &&
      !restrictedQuestion(input.question) &&
      process.env.ALLOW_EXTERNAL_AI_FOR_SYNTHETIC_CHAT === 'true' &&
      Boolean(process.env.GEMINI_API_KEY);
    let topic = null;
    if (allowCloud && Date.now() - (recent.get(user.id) ?? 0) > 60000) {
      if (recent.size > 1000) recent.clear();
      recent.set(user.id, Date.now());
      topic = await routeSyntheticQuestion(input.question, {
        enabled: true,
        apiKey: process.env.GEMINI_API_KEY,
      });
    }
    const answer = answerHistory(input.question, records, projection, topic ?? undefined);
    if (topic) answer.mode = 'gemini_topic_router';
    return Response.json(answer, { headers });
  } catch {
    return Response.json(
      { error: 'History could not be checked. Sign in again or try a shorter question.' },
      { status: 401, headers },
    );
  }
}
