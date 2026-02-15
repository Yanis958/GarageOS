"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";

export type Priority = "urgent" | "aujourdhui" | "avenir";

export type ActionItem = {
  id: string;
  type: "relance_devis" | "intervention" | "facture" | "alerte";
  priority: Priority;
  /** Libellé court pour la carte */
  label: string;
  /** Nom du client */
  clientName: string | null;
  /** Référence devis / facture */
  reference: string | null;
  /** Montant TTC (affiché en gras si pertinent) */
  amount: number | null;
  /** Détail secondaire (ex. "Envoyé il y a 5 jours", "RDV dépassé") */
  detail: string;
  quoteId: string;
  vehicleLabel?: string | null;
  /** Sous-type pour style (expired, to_relance, accepted_no_date, rdv_en_retard, facture_impayee) */
  subType?: string;
};

export type ActionsDuJour = {
  summary: string;
  urgent: ActionItem[];
  aujourdhui: ActionItem[];
  aVenir: ActionItem[];
};

const JOURS_RELANCE = 3;
const JOURS_FACTURE_RAPPEL = 7;

function joursDepuis(d: string): number {
  const today = new Date().toISOString().slice(0, 10);
  return Math.floor((new Date(today).getTime() - new Date(d).getTime()) / (24 * 60 * 60 * 1000));
}

function formatJours(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "il y a 1 jour";
  return `il y a ${days} jours`;
}

/** Relances devis : expirés, à relancer, à finaliser (brouillons). */
async function getRelances(garageId: string): Promise<ActionItem[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - JOURS_RELANCE * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  let q = supabase
    .from("quotes")
    .select("id, reference, status, valid_until, created_at, total_ttc, clients(name)")
    .eq("garage_id", garageId)
    .in("status", ["sent", "draft"])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  const { data: quotes, error } = await q;
  if (error || !quotes) return [];

  type Row = { id: string; reference: string | null; status: string; valid_until: string | null; created_at: string; total_ttc?: number; clients: { name: string | null } | null };
  const expired: Row[] = [];
  const toRelance: Row[] = [];
  const toFinalize: Row[] = [];
  for (const r of quotes as Row[]) {
    const created = new Date(r.created_at);
    const validUntil = r.valid_until ?? null;
    if (r.status === "sent") {
      if (validUntil && validUntil < today) {
        if (expired.length < 10) expired.push(r);
      } else if (created < threeDaysAgo) {
        if (toRelance.length < 10) toRelance.push(r);
      }
    } else if (r.status === "draft" && created < twoDaysAgo) {
      if (toFinalize.length < 10) toFinalize.push(r);
    }
  }

  const items: ActionItem[] = [];
  for (const q of expired) {
    const days = q.created_at ? joursDepuis(q.created_at.slice(0, 10)) : 0;
    const name = q.clients?.name ?? null;
    const amount = typeof q.total_ttc === "number" ? q.total_ttc : null;
    items.push({
      id: `relance-expired-${q.id}`,
      type: "relance_devis",
      priority: "urgent",
      label: amount != null ? `Relancer ${name ?? "client"} – devis ${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : `Relancer ${name ?? "client"} – devis ${q.reference ?? "—"}`,
      clientName: name,
      reference: q.reference,
      amount,
      detail: `Expiré ${formatJours(days)}`,
      quoteId: q.id,
      subType: "expired",
    });
  }
  for (const q of toRelance) {
    const days = q.created_at ? joursDepuis(q.created_at.slice(0, 10)) : 0;
    const name = q.clients?.name ?? null;
    const amount = typeof q.total_ttc === "number" ? q.total_ttc : null;
    items.push({
      id: `relance-sent-${q.id}`,
      type: "relance_devis",
      priority: "aujourdhui",
      label: amount != null ? `Relancer ${name ?? "client"} – devis ${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : `Relancer ${name ?? "client"} – devis ${q.reference ?? "—"}`,
      clientName: name,
      reference: q.reference,
      amount,
      detail: `Envoyé ${formatJours(days)}`,
      quoteId: q.id,
      subType: "to_relance",
    });
  }
  for (const q of toFinalize) {
    const name = q.clients?.name ?? null;
    items.push({
      id: `relance-draft-${q.id}`,
      type: "relance_devis",
      priority: "avenir",
      label: `Finaliser le devis – ${name ?? "client"}`,
      clientName: name,
      reference: q.reference,
      amount: typeof q.total_ttc === "number" ? q.total_ttc : null,
      detail: "Brouillon à envoyer",
      quoteId: q.id,
      subType: "to_finalize",
    });
  }
  return items;
}

/** Devis acceptés sans date + RDV dépassés non clôturés. */
async function getInterventionsAOrganiser(garageId: string): Promise<ActionItem[]> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const items: ActionItem[] = [];

  // 1) Acceptés sans planned_at
  let q = supabase
    .from("quotes")
    .select("id, reference, total_ttc, created_at, clients(name), vehicles(brand, model, registration)")
    .eq("garage_id", garageId)
    .eq("status", "accepted")
    .is("archived_at", null)
    .is("planned_at", null)
    .order("created_at", { ascending: false })
    .limit(15);
  const { data: acceptedNoDate } = await q;
  for (const row of acceptedNoDate ?? []) {
    const r = row as { id: string; reference: string | null; total_ttc?: number; clients?: { name: string | null } | null; vehicles?: { brand?: string | null; model?: string | null; registration?: string | null } | null };
    const name = r.clients?.name ?? null;
    const v = r.vehicles;
    const vehicleLabel = v ? [v.brand, v.model].filter(Boolean).join(" ") || (v as { registration?: string | null }).registration || null : null;
    const amount = typeof r.total_ttc === "number" ? r.total_ttc : null;
    items.push({
      id: `interv-nodate-${r.id}`,
      type: "intervention",
      priority: "aujourdhui",
      label: vehicleLabel ? `Planifier RDV – ${vehicleLabel}` : `Planifier RDV – ${name ?? r.reference ?? "Devis"}`,
      clientName: name,
      reference: r.reference,
      amount,
      detail: "Devis accepté, pas de date",
      quoteId: r.id,
      vehicleLabel: vehicleLabel ?? null,
      subType: "accepted_no_date",
    });
  }

  // 2) RDV dépassés (planned_at < today, pas de facture)
  q = supabase
    .from("quotes")
    .select("id, reference, planned_at, total_ttc, facture_number, clients(name), vehicles(brand, model, registration)")
    .eq("garage_id", garageId)
    .eq("status", "accepted")
    .is("archived_at", null)
    .not("planned_at", "is", null)
    .lt("planned_at", today);
  const { data: overdue } = await q;
  for (const row of overdue ?? []) {
    const r = row as { id: string; reference: string | null; planned_at: string | null; total_ttc?: number; facture_number?: string | null; clients?: { name: string | null } | null; vehicles?: { brand?: string | null; model?: string | null; registration?: string | null } | null };
    const hasFacture = !!r.facture_number?.trim();
    if (hasFacture) continue;
    const name = r.clients?.name ?? null;
    const v = r.vehicles;
    const vehicleLabel = v ? [v.brand, v.model].filter(Boolean).join(" ") || (v as { registration?: string | null }).registration || null : null;
    const planned = r.planned_at ? r.planned_at.slice(0, 10) : "";
    const days = planned ? joursDepuis(planned) : 0;
    items.push({
      id: `interv-overdue-${r.id}`,
      type: "intervention",
      priority: "urgent",
      label: vehicleLabel ? `RDV dépassé – ${vehicleLabel}` : `RDV dépassé – ${name ?? r.reference ?? "—"}`,
      clientName: name,
      reference: r.reference,
      amount: typeof r.total_ttc === "number" ? r.total_ttc : null,
      detail: days > 0 ? `Prévu il y a ${days} jour${days > 1 ? "s" : ""}` : "Prévu aujourd'hui",
      quoteId: r.id,
      vehicleLabel: vehicleLabel ?? null,
      subType: "rdv_en_retard",
    });
  }

  return items;
}

/** Factures émises non réglées (payment_status null / unpaid / partial). */
async function getFacturesAEncaisser(garageId: string): Promise<ActionItem[]> {
  const supabase = await createClient();
  let q = supabase
    .from("quotes")
    .select("id, reference, total_ttc, facture_number, payment_status, created_at, clients(name)")
    .eq("garage_id", garageId)
    .eq("status", "accepted")
    .not("facture_number", "is", null);
  const { data: rows } = await q;
  const items: ActionItem[] = [];
  const unpaidStatuses = ["unpaid", "partial", null];
  for (const row of rows ?? []) {
    const r = row as { id: string; reference: string | null; total_ttc?: number; facture_number?: string | null; payment_status?: string | null; created_at?: string; clients?: { name: string | null } | null };
    const status = r.payment_status ?? null;
    if (status === "paid") continue;
    const name = r.clients?.name ?? null;
    const amount = typeof r.total_ttc === "number" ? r.total_ttc : null;
    const created = r.created_at ? r.created_at.slice(0, 10) : "";
    const days = created ? joursDepuis(created) : 0;
    const priority: Priority = days >= JOURS_FACTURE_RAPPEL ? "urgent" : "aujourdhui";
    items.push({
      id: `facture-${r.id}`,
      type: "facture",
      priority,
      label: amount != null ? `Facture impayée – ${name ?? "client"} – ${amount.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} €` : `Facture impayée – ${name ?? r.reference ?? "—"}`,
      clientName: name,
      reference: r.facture_number ?? r.reference,
      amount,
      detail: days >= 1 ? `Émise ${formatJours(days)}` : "Émise aujourd'hui",
      quoteId: r.id,
      subType: "facture_impayee",
    });
  }
  return items;
}

/** Agrège tout et construit le résumé. */
export async function getActionsDuJour(): Promise<ActionsDuJour> {
  const garageId = await getCurrentGarageId();
  if (!garageId) {
    return { summary: "Aucune action pour le moment.", urgent: [], aujourdhui: [], aVenir: [] };
  }

  const [relances, interventions, factures] = await Promise.all([
    getRelances(garageId),
    getInterventionsAOrganiser(garageId),
    getFacturesAEncaisser(garageId),
  ]);

  const urgent: ActionItem[] = [];
  const aujourdhui: ActionItem[] = [];
  const aVenir: ActionItem[] = [];

  for (const a of [...relances, ...interventions, ...factures]) {
    if (a.priority === "urgent") urgent.push(a);
    else if (a.priority === "aujourdhui") aujourdhui.push(a);
    else aVenir.push(a);
  }

  const total = urgent.length + aujourdhui.length + aVenir.length;
  const parts: string[] = [];
  if (urgent.length) parts.push(`${urgent.length} urgent${urgent.length > 1 ? "s" : ""}`);
  if (aujourdhui.length) parts.push(`${aujourdhui.length} aujourd'hui`);
  if (aVenir.length) parts.push(`${aVenir.length} à venir`);
  const summary =
    total === 0
      ? "Rien à faire pour le moment. Tout est à jour."
      : `Aujourd'hui, vous avez ${total} action${total > 1 ? "s" : ""} : ${parts.join(", ")}.`;

  return { summary, urgent, aujourdhui, aVenir };
}

/** Marquer une facture comme payée (pour l’onglet Actions du jour). */
export async function markFacturePayee(quoteId: string): Promise<{ error?: string }> {
  const { updateQuoteAction } = await import("./quotes");
  return updateQuoteAction(quoteId, { payment_status: "paid" });
}
