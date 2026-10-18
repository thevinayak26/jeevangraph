import test from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, strToU8 } from 'fflate';
import { expandHistoryFiles } from '../src/lib/history-archive.ts';
const zip = (entries) => new File([zipSync(entries)], 'history.zip', { type: 'application/zip' });
test('history ZIP unpacks supported reports in stable order and ignores readme', async () => {
  const files = await expandHistoryFiles([
    zip({
      '02_rx.pdf': strToU8('%PDF-1.4 synthetic'),
      '01_lab.pdf': strToU8('%PDF-1.4 lab'),
      'README.md': strToU8('fictional'),
    }),
  ]);
  assert.deepEqual(
    files.map((f) => f.name),
    ['01_lab.pdf', '02_rx.pdf'],
  );
  assert(files.every((f) => f.type === 'application/pdf'));
});
test('history ZIP rejects traversal, too many reports and declared oversized entries', async () => {
  await assert.rejects(expandHistoryFiles([zip({ '../lab.pdf': strToU8('fake') })]));
  await assert.rejects(
    expandHistoryFiles([
      zip(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [i + '.pdf', strToU8('fake')]))),
    ]),
  );
  await assert.rejects(expandHistoryFiles([zip({ 'large.pdf': new Uint8Array(4_000_001) })]));
});
test('empty/corrupt ZIP and unsupported file never become importable reports', async () => {
  await assert.rejects(expandHistoryFiles([new File(['bad'], 'broken.zip')]));
  await assert.rejects(expandHistoryFiles([new File(['text'], 'file.txt')]));
  await assert.rejects(expandHistoryFiles([zip({ 'README.md': strToU8('No reports') })]));
});
