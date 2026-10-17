import { getServiceConfiguration } from '@/lib/config';

export async function GET() {
  return Response.json(
    { status: 'ok', release: 'phase-1', ...getServiceConfiguration() },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
