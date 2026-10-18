import 'server-only';

export function getServiceConfiguration() {
  return {
    dataMode: 'synthetic_preview' as const,
    documentScanning: 'local_pdf_text_and_printed_english_ocr',
    privateRecordsExternalInferenceEnabled: false,
    externalChatRoutingEnabled:
      process.env.ALLOW_EXTERNAL_AI_FOR_SYNTHETIC_CHAT === 'true' &&
      Boolean(process.env.GEMINI_API_KEY),
    externalChatRoutingScope: 'explicitly_attested_fictional_question_only',
    secureWorkspaceAvailable: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
    selectedModel: 'gemini-3.5-flash-lite',
    externalInferenceEnabled:
      process.env.AI_PROVIDER === 'gemini' &&
      process.env.ALLOW_EXTERNAL_AI_FOR_BUNDLED_FIXTURES === 'true' &&
      Boolean(process.env.GEMINI_API_KEY),
    externalInferenceScope: 'bundled_fictional_facts_only',
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
