import { authorizedEvidence } from '@/lib/evidence-repository';
export const dynamic = 'force-dynamic';
export async function GET() {
  try {
    return Response.json(await authorizedEvidence(), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return Response.json(
      { error: 'Evidence unavailable. Sign in and check the connection.' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
