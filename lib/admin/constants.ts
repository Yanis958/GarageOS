/** Clés des feature flags gérés dans l’admin (un fichier sans "use server" pour permettre l’export). */
export const ADMIN_FEATURE_KEYS = [
  "ai_quote_explain",
  "ai_copilot",
  "ai_insights",
  "ai_quote_audit",
  "ai_generate_lines",
  "ai_planning",
  "ai_quick_note",
  "ai_client_message",
] as const;

export type AdminFeatureKey = (typeof ADMIN_FEATURE_KEYS)[number];
