"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";

export type InsightsStats = {
  /** Taux acceptation = acceptedCount / (acceptedCount + sentCount), ou null si aucun envoyé */
  acceptanceRate: number | null;
  /** Panier moyen TTC des devis acceptés (€) */
  averageBasket: number | null;
  /** Somme total_ttc des devis en statut "sent" (CA potentiel en attente) */
  estimatedCa: number;
  acceptedCount: number;
  sentCount: number;
  totalAcceptedTtc: number;
  /** Somme des quantity des lignes type labor sur devis acceptés (heures estimées) */
  laborHoursEstimated: number | null;
  /** Nombre de lignes (devis acceptés) avec marge négative ou très faible (< 5 % du total ligne) */
  lowMarginItemsCount: number | null;
};

export async function getInsightsStats(): Promise<InsightsStats> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("quotes").select("id, status, total_ttc").is("archived_at", null);
  if (garageId) query = query.eq("garage_id", garageId);
  let result = await query;
  if (result.error && (result.error.message?.includes("archived_at") || result.error.message?.includes("does not exist"))) {
    query = supabase.from("quotes").select("id, status, total_ttc");
    if (garageId) query = query.eq("garage_id", garageId);
    result = await query;
  }
  const { data: quotes, error } = result;
  if (error || !quotes) {
    return {
      acceptanceRate: null,
      averageBasket: null,
      estimatedCa: 0,
      acceptedCount: 0,
      sentCount: 0,
      totalAcceptedTtc: 0,
      laborHoursEstimated: null,
      lowMarginItemsCount: null,
    };
  }

  let sentCount = 0;
  let acceptedCount = 0;
  let totalAcceptedTtc = 0;
  let estimatedCa = 0;
  const acceptedIds: string[] = [];

  for (const q of quotes) {
    const amount = Number(q.total_ttc) || 0;
    if (q.status === "sent") {
      sentCount += 1;
      estimatedCa += amount;
    } else if (q.status === "accepted") {
      acceptedCount += 1;
      totalAcceptedTtc += amount;
      acceptedIds.push(q.id);
    }
  }

  const acceptanceRate =
    acceptedCount + sentCount > 0 ? acceptedCount / (acceptedCount + sentCount) : null;
  const averageBasket =
    acceptedCount > 0 ? Math.round((totalAcceptedTtc / acceptedCount) * 100) / 100 : null;

  let laborHoursEstimated: number | null = null;
  let lowMarginItemsCount: number | null = null;

  if (acceptedIds.length > 0) {
    const { data: items } = await supabase
      .from("quote_items")
      .select("type, quantity, margin_ht, total")
      .in("quote_id", acceptedIds);

    if (items && items.length > 0) {
      let laborHours = 0;
      let lowMargin = 0;
      for (const it of items) {
        const type = (it as { type?: string }).type;
        const qty = Number((it as { quantity?: number }).quantity) || 0;
        const marginHt = (it as { margin_ht?: number | null }).margin_ht;
        const total = Number((it as { total?: number }).total) || 0;
        if (type === "labor") laborHours += qty;
        if (marginHt != null && typeof marginHt === "number") {
          if (marginHt < 0) lowMargin += 1;
          else if (total > 0 && marginHt < 0.05 * total) lowMargin += 1;
        }
      }
      laborHoursEstimated = laborHours > 0 ? Math.round(laborHours * 100) / 100 : null;
      lowMarginItemsCount = lowMargin;
    }
  }

  return {
    acceptanceRate,
    averageBasket,
    estimatedCa: Math.round(estimatedCa * 100) / 100,
    acceptedCount,
    sentCount,
    totalAcceptedTtc: Math.round(totalAcceptedTtc * 100) / 100,
    laborHoursEstimated,
    lowMarginItemsCount,
  };
}
