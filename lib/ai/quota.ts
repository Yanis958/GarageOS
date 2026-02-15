"use server";

import { createClient } from "@/lib/supabase/server";

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Vérifie si le garage peut encore consommer des requêtes IA ce mois-ci.
 * Lit garage_settings.ai_monthly_quota et ai_usage pour le mois courant.
 * @returns allowed: false si quota défini et dépassé ; current/limit pour affichage optionnel.
 */
export async function checkAiQuota(garageId: string): Promise<{
  allowed: boolean;
  current?: number;
  limit?: number | null;
}> {
  const supabase = await createClient();
  const period = currentPeriod();

  const { data: settings } = await supabase
    .from("garage_settings")
    .select("ai_monthly_quota")
    .eq("garage_id", garageId)
    .maybeSingle();

  const quota: number | null = settings?.ai_monthly_quota ?? null;
  if (quota == null) {
    return { allowed: true };
  }

  const { data: usage } = await supabase
    .from("ai_usage")
    .select("request_count")
    .eq("garage_id", garageId)
    .eq("period", period)
    .maybeSingle();

  const current = usage?.request_count ?? 0;
  if (current >= quota) {
    return { allowed: false, current, limit: quota };
  }
  return { allowed: true, current, limit: quota };
}
