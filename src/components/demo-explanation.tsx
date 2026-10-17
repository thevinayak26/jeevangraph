'use client';
import { useActionState } from 'react';
import { requestDemoExplanation } from '@/app/secure/explanation-action';
import { bundledFacts, type Explanation } from '@/lib/demo-explanation';
export function DemoExplanation() {
  const [result, action, pending] = useActionState<Explanation | null, FormData>(
    requestDemoExplanation,
    null,
  );
  return (
    <section className="panel">
      <h2>Optional explanation of the fictional demo</h2>
      <p>
        This separate demonstration uses only the four bundled fictional reports. Your uploaded
        records and relatives’ conditions are never sent to the cloud.
      </p>
      <form action={action}>
        <label>
          <input type="checkbox" name="confirmed" value="yes" /> Allow the configured Gemini service
          to receive the fixed fictional fact list for this request.
        </label>
        <button className="button secondary" disabled={pending}>
          {pending ? 'Preparing explanation…' : 'Explain fictional evidence'}
        </button>
      </form>
      <p role="status">
        {result?.reason ?? 'The deterministic explanation below works without an API key.'}
      </p>
      <p>{result?.intro}</p>
      <ul>
        {(result?.facts ?? bundledFacts).map((f) => (
          <li key={f.id}>{f.text}</li>
        ))}
      </ul>
      <p className="phase3-notice">
        {result?.notice ??
          'Synthetic and unvalidated. This does not diagnose disease or recommend treatment.'}
      </p>
    </section>
  );
}
