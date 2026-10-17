import { getServiceConfiguration } from '@/lib/config';

export async function GET() {
  return Response.json(
    { status: 'ok', release: 'phase-3', ...getServiceConfiguration() },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
