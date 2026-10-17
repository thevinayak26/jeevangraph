import 'server-only';

export function getServiceConfiguration() {
  return {
    dataMode: 'synthetic_preview' as const,
    selectedModel: 'gemini-3.5-flash-lite',
    externalInferenceEnabled: false,
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}
