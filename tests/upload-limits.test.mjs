import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadSizeAllowed } from '../src/lib/upload-limits.ts';
test('hosted file-size boundary leaves multipart headroom and rejects empty/invalid sizes', () => {
  assert(uploadSizeAllowed(4_000_000));
  for (const size of [0, -1, 4_000_001, 4_500_000, NaN, Infinity, 1.2])
    assert.equal(uploadSizeAllowed(size), false);
});
