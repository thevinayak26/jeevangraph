'use client';
import { useState } from 'react';
import { uploadSizeAllowed } from '@/lib/upload-limits';
export function SourceFileInput() {
  const [error, setError] = useState('');
  return (
    <>
      <input
        name="file"
        type="file"
        accept="application/pdf,image/png,image/jpeg"
        required
        aria-describedby="source-file-limit"
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          const message =
            file && !uploadSizeAllowed(file.size)
              ? 'Choose a non-empty file no larger than 4 MB.'
              : '';
          e.currentTarget.setCustomValidity(message);
          setError(message);
        }}
      />
      <span id="source-file-limit" role={error ? 'alert' : undefined}>
        {error || 'PDF, PNG or JPEG, maximum 4 MB (4,000,000 bytes).'}
      </span>
    </>
  );
}
