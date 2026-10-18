import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const name = 'jg-rls-' + crypto.randomUUID().slice(0, 8);
const docker = (args, options = {}) =>
  execFileSync('docker', args, { encoding: 'utf8', ...options });
try {
  docker([
    'run',
    '--detach',
    '--rm',
    '--name',
    name,
    '--network',
    'none',
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    'postgres:17-alpine',
  ]);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    try {
      docker(['exec', name, 'pg_isready', '-U', 'postgres'], { stdio: 'pipe' });
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!ready) throw new Error('Disposable database did not start');
  for (const path of [
    'supabase/tests/bootstrap.sql',
    'supabase/migrations/202610180001_secure_records.sql',
    'supabase/migrations/202610180002_evidence_family.sql',
    'supabase/migrations/202610180003_analysis_consent.sql',
    'supabase/migrations/202610180004_welcome_assessment.sql',
    'supabase/migrations/202610180005_hosted_upload_limit.sql',
    'supabase/migrations/202610180006_scan_import.sql',
    'supabase/tests/access.sql',
    'supabase/tests/family.sql',
    'supabase/tests/assessment.sql',
    'supabase/tests/scan.sql',
  ]) {
    const output = docker(['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
      input: readFileSync(path, 'utf8'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    if (!output) throw new Error('No database output');
  }
  console.log('PostgreSQL RLS access matrix passed in isolated disposable database.');
} finally {
  try {
    docker(['stop', name], { stdio: 'pipe' });
  } catch {
    /* Already stopped. */
  }
}
