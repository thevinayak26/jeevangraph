import { z } from 'zod';
// The complete outbound corpus is a fixed, fictional fact list. Never accept record text here.
export const bundledFacts = [
  {
    id: 'F1',
    text: 'Four fictional creatinine results are 0.90, 1.10, 1.40 and 1.60 mg/dL on 2026-01-06, 2026-03-17, 2026-06-19 and 2026-09-09.',
  },
  { id: 'F2', text: 'The first-to-last numerical change is +0.70 mg/dL (+77.8%) over 246 days.' },
  {
    id: 'F3',
    text: 'Assay methods and clinical context are not established. These numerical observations are not a diagnosis.',
  },
  {
    id: 'F4',
    text: 'Reported eGFR values are 104, 88, 66 and 57 mL/min/1.73m². Their calculation methods are unspecified; no eGFR is recomputed or disease stage assigned.',
  },
] as const;
const responseSchema = z
  .object({
    template: z.enum(['timeline', 'evidence_first']),
    factIds: z
      .array(z.enum(['F1', 'F2', 'F3', 'F4']))
      .min(3)
      .max(4),
  })
  .strict();
export type Explanation = {
  mode: 'deterministic' | 'gemini_selected';
  reason: string;
  intro: string;
  facts: { id: string; text: string }[];
  notice: string;
};
export type ExplanationConfig = {
  enabled: boolean;
  apiKey?: string;
  model?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
};
function render(
  order: readonly string[],
  template: 'timeline' | 'evidence_first',
  mode: Explanation['mode'],
  reason: string,
): Explanation {
  return {
    mode,
    reason,
    intro:
      template === 'timeline'
        ? 'Available fictional reports, in context:'
        : 'Start with the supporting fictional evidence:',
    facts: order.map((id) => bundledFacts.find((f) => f.id === id)!),
    notice:
      'Synthetic, unvalidated demonstration. Clinical interpretation belongs to a qualified clinician.',
  };
}
export async function explainBundledDemo(config: ExplanationConfig): Promise<Explanation> {
  const fallback = (reason: string) =>
    render(['F1', 'F2', 'F3', 'F4'], 'timeline', 'deterministic', reason);
  if (!config.enabled) return fallback('Cloud explanation is disabled.');
  if (!config.apiKey) return fallback('No API key configured.');
  if (config.model && config.model !== 'gemini-3.5-flash-lite')
    return fallback('Configured model is outside the approved demo allowlist.');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const operation = async () => {
      const response = await (config.fetcher ?? fetch)(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
        {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey! },
          body: JSON.stringify({
            systemInstruction: {
              parts: [
                {
                  text: 'Select an ordering of the provided fictional fact IDs and one allowed template. Include F1, F2 and F3. Do not produce prose, numbers, diagnoses or additional fields. Return only the requested JSON.',
                },
              ],
            },
            contents: [{ role: 'user', parts: [{ text: JSON.stringify(bundledFacts) }] }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 256,
              responseMimeType: 'application/json',
              responseJsonSchema: {
                type: 'object',
                properties: {
                  template: { type: 'string', enum: ['timeline', 'evidence_first'] },
                  factIds: {
                    type: 'array',
                    items: { type: 'string', enum: ['F1', 'F2', 'F3', 'F4'] },
                    minItems: 3,
                    maxItems: 4,
                  },
                },
                required: ['template', 'factIds'],
                additionalProperties: false,
              },
            },
          }),
        },
      );
      if (!response.ok) throw new Error('Provider unavailable or quota exhausted');
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Missing response');
      const chunks: Uint8Array[] = [];
      let length = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.length;
        if (length > 64000) {
          await reader.cancel();
          throw new Error('Oversized response');
        }
        chunks.push(value);
      }
      const text = chunks.map((c) => new TextDecoder().decode(c)).join('');
      const envelope = JSON.parse(text) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const candidate = envelope.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
      if (!candidate) throw new Error('Empty provider response');
      const parsed = responseSchema.parse(JSON.parse(candidate));
      if (
        new Set(parsed.factIds).size !== parsed.factIds.length ||
        !['F1', 'F2', 'F3'].every((id) => parsed.factIds.includes(id as 'F1' | 'F2' | 'F3'))
      )
        throw new Error('Missing grounding or safety fact');
      return render(
        parsed.factIds,
        parsed.template,
        'gemini_selected',
        'Gemini selected an approved fact order. All displayed wording is evidence-locked.',
      );
    };
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Timeout'));
      }, config.timeoutMs ?? 4500);
    });
    return await Promise.race([operation(), timeout]);
  } catch {
    return fallback('Provider timeout, quota, response or validation failure.');
  } finally {
    if (timer) clearTimeout(timer);
  }
}
