"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";
import { getTodayInterventions } from "./planning";

export type PrioriteDuJourType =
  | "accepted_no_date"
  | "sent_no_response_7d"
  | "interventions_today"
  | "none";

export type PrioriteDuJour = {
  type: PrioriteDuJourType;
  message: string;
  buttonLabel: string;
  href: string;
  icon: "calendar" | "alert" | "clock" | "check";
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** Une seule priorité du jour, dans l'ordre : devis acceptés sans date → devis à relancer 7j → interventions aujourd'hui → aucune urgence. */
export async function getPrioriteDuJour(): Promise<PrioriteDuJour> {
  const garageId = await getCurrentGarageId();
  if (!garageId) {
    return {
      type: "none",
      message: "Aucune urgence aujourd'hui. Tout est sous contrôle.",
      buttonLabel: "Voir l'activité récente",
      href: "/dashboard/devis",
      icon: "check",
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - SEVEN_DAYS_MS);
  const supabase = await createClient();

  // 1) Devis acceptés sans date d'intervention
  const { count: acceptedNoDateCount } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("garage_id", garageId)
    .eq("status", "accepted")
    .is("archived_at", null)
    .is("planned_at", null);

  const n1 = acceptedNoDateCount ?? 0;
  if (n1 > 0) {
    return {
      type: "accepted_no_date",
      message:
        n1 === 1
          ? "1 devis accepté nécessite une planification"
          : `${n1} devis acceptés nécessitent une planification`,
      buttonLabel: "Voir dans le planning",
      href: "/dashboard/planning",
      icon: "calendar",
    };
  }

  // 2) Devis envoyés sans réponse depuis plus de 7 jours
  const { data: sentQuotes } = await supabase
    .from("quotes")
    .select("id, created_at")
    .eq("garage_id", garageId)
    .eq("status", "sent")
    .is("archived_at", null);

  const sentNoResponse7d = (sentQuotes ?? []).filter(
    (q: { created_at: string }) => new Date(q.created_at) < sevenDaysAgo
  );
  const n2 = sentNoResponse7d.length;
  if (n2 > 0) {
    return {
      type: "sent_no_response_7d",
      message:
        n2 === 1
          ? "1 devis envoyé sans réponse depuis plus de 7 jours"
          : `${n2} devis envoyés sans réponse depuis plus de 7 jours`,
      buttonLabel: "Voir les devis à relancer",
      href: "/dashboard/devis?toRelance=1",
      icon: "alert",
    };
  }

  // 3) Interventions prévues aujourd'hui (planned_at = today ou RDV aujourd'hui)
  const interventions = await getTodayInterventions();
  const interventionsToday = interventions.filter((r) => {
    const planned = r.planned_at ? r.planned_at.slice(0, 10) : null;
    return planned === today;
  });
  const n3 = interventionsToday.length;
  if (n3 > 0) {
    return {
      type: "interventions_today",
      message:
        n3 === 1
          ? "1 intervention prévue aujourd'hui"
          : `${n3} interventions prévues aujourd'hui`,
      buttonLabel: "Voir le planning du jour",
      href: "/dashboard/planning",
      icon: "clock",
    };
  }

  // 4) Aucun point critique
  return {
    type: "none",
    message: "Aucune urgence aujourd'hui. Tout est sous contrôle.",
    buttonLabel: "Voir l'activité récente",
    href: "/dashboard/devis",
    icon: "check",
  };
}
