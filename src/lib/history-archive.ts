import { unzip } from 'fflate';
export const ARCHIVE_MAX_BYTES = 10_000_000;
export const ARCHIVE_TOTAL_BYTES = 20_000_000;
export const HISTORY_MAX_FILES = 8;
export async function expandHistoryFiles(inputs: File[]): Promise<File[]> {
  const reports: File[] = [];
  let total = 0;
  function add(name: string, bytes: Uint8Array) {
    if (reports.length >= HISTORY_MAX_FILES)
      throw new Error('Choose a history pack with up to 8 reports.');
    if (bytes.length === 0 || bytes.length > 4_000_000)
      throw new Error('Each report must be non-empty and at most 4 MB.');
    total += bytes.length;
    if (total > ARCHIVE_TOTAL_BYTES) throw new Error('Unpacked reports must total at most 20 MB.');
    const ext = name.toLowerCase().split('.').pop();
    const type = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg';
    reports.push(new File([Uint8Array.from(bytes).buffer], name.split('/').pop()!, { type }));
  }
  for (const input of inputs) {
    const ext = input.name.toLowerCase().split('.').pop();
    if (ext === 'zip') {
      if (input.size > ARCHIVE_MAX_BYTES) throw new Error('ZIP files must be at most 10 MB.');
      const bytes = new Uint8Array(await input.arrayBuffer());
      let entries = 0,
        pendingSize = total,
        pendingCount = reports.length;
      const unpacked = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        try {
          unzip(
            bytes,
            {
              filter: (entry) => {
                if (++entries > 64) throw new Error('Archive contains too many entries.');
                if (
                  entry.name.startsWith('/') ||
                  entry.name.includes('\\') ||
                  entry.name.split('/').includes('..')
                )
                  throw new Error('Unsafe ZIP path.');
                if (!/\.(pdf|png|jpe?g)$/i.test(entry.name) || entry.name.startsWith('__MACOSX/'))
                  return false;
                if (
                  ++pendingCount > 8 ||
                  entry.originalSize > 4_000_000 ||
                  entry.originalSize === 0 ||
                  (pendingSize += entry.originalSize) > ARCHIVE_TOTAL_BYTES
                )
                  throw new Error(
                    'ZIP exceeds the 8-report, 4 MB per report or 20 MB unpacked limit.',
                  );
                return true;
              },
            },
            (error, data) =>
              error
                ? reject(
                    new Error(
                      'ZIP could not be safely unpacked. Use a standard unencrypted ZIP with up to 8 reports.',
                    ),
                  )
                : resolve(data),
          );
        } catch (error) {
          reject(error);
        }
      });
      for (const [name, data] of Object.entries(unpacked).sort(([a], [b]) => a.localeCompare(b)))
        add(name, data);
    } else if (['pdf', 'png', 'jpg', 'jpeg'].includes(ext ?? ''))
      add(input.name, new Uint8Array(await input.arrayBuffer()));
    else throw new Error('Choose a ZIP, PDF, PNG or JPEG.');
  }
  if (!reports.length) throw new Error('No PDF, PNG or JPEG reports were found.');
  return reports;
}
