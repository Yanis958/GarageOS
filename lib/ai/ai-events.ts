"use server";

import { createClient } from "@/lib/supabase/server";

export type AiEventFeature =
  | "quote_explain"
  | "audit"
  | "copilot"
  | "insights"
  | "planning_suggest"
  | "quick_note"
  | "client_message"
  | "generate_quote_lines";

/**
 * Log un événement IA (succès ou erreur) : console + insert ai_events.
 * Ne bloque pas la réponse ; en cas d'échec d'insert, on ignore (try/catch).
 */
export async function logAiEvent(
  garageId: string,
  userId: string | undefined,
  feature: AiEventFeature,
  status: "success" | "error",
  latencyMs: number,
  tokensIn?: number | null,
  tokensOut?: number | null
): Promise<void> {
  const line = `[AI] ${feature} ${status} ${latencyMs}ms garage=${garageId}`;
  console.log(line);

  try {
    const supabase = await createClient();
    await supabase.from("ai_events").insert({
      garage_id: garageId,
      user_id: userId ?? null,
      feature,
      status,
      latency_ms: latencyMs,
      tokens_in: tokensIn ?? null,
      tokens_out: tokensOut ?? null,
    });
  } catch {
    // Ne pas faire échouer la requête si l'écriture échoue
  }
}
