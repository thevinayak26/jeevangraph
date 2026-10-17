import { createClient } from '@supabase/supabase-js';
import { requireSession } from '@/lib/supabase/server';
import { uuid } from '@/lib/secure-validation';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = uuid.parse((await params).id);
    const { db } = await requireSession();
    const draft = new URL(_request.url).searchParams.get('draft') === '1';
    const procedure = draft ? 'read_draft_source' : 'read_source';
    const args = draft ? { p_draft: id } : { p_version: id };
    const { data: path, error } = await db.rpc(procedure, args);
    if (error || !path)
      return new Response('Unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Source delivery not configured');
    const storage = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error: downloadError } = await storage.storage
      .from('health-records')
      .download(path);
    if (downloadError || !data)
      return new Response('Unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const recheck = await db.rpc(procedure, args);
    if (recheck.error || recheck.data !== path) throw new Error('Access changed');
    return new Response(await data.arrayBuffer(), {
      headers: {
        'Content-Type': data.type || 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="source-report"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    });
  } catch {
    return new Response('Unavailable', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
}
