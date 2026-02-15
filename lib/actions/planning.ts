"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";
import type { SlotLabel } from "@/lib/ai/planning-types";
import { getWeekDays, getMondayOfWeek } from "@/lib/utils/planning";

export type AcceptedQuoteWithDuration = {
  id: string;
  reference: string | null;
  clientName: string | null;
  durationHours: number;
  total_ttc?: number;
};

export type PlanningAssignmentRow = {
  id: string;
  quote_id: string;
  assignment_date: string;
  slot_label: SlotLabel;
  status: "proposed" | "confirmed";
  reference?: string | null;
  durationHours?: number;
};

export async function getAcceptedQuotesWithDuration(): Promise<AcceptedQuoteWithDuration[]> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return [];
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("id, reference, total_ttc, created_at, clients(name)")
    .eq("status", "accepted")
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  query = query.eq("garage_id", garageId);

  let result = await query;
  if (result.error && (result.error.message?.includes("archived_at") || result.error.message?.includes("does not exist"))) {
    query = supabase
      .from("quotes")
      .select("id, reference, total_ttc, created_at, clients(name)")
      .eq("status", "accepted")
      .eq("garage_id", garageId)
      .order("created_at", { ascending: false });
    result = await query;
  }
  const quotes = result.data ?? [];
  if (quotes.length === 0) return [];

  const ids = quotes.map((q: { id: string }) => q.id);
  const { data: items } = await supabase
    .from("quote_items")
    .select("quote_id, type, quantity")
    .in("quote_id", ids);

  const durationByQuote: Record<string, number> = {};
  for (const it of items ?? []) {
    const qid = (it as { quote_id: string }).quote_id;
    const type = (it as { type?: string }).type;
    const qty = Number((it as { quantity?: number }).quantity) || 0;
    if (type === "labor") {
      durationByQuote[qid] = (durationByQuote[qid] ?? 0) + qty;
    }
  }

  return quotes.map((q: { id: string; reference: string | null; total_ttc?: number; clients?: { name: string | null } | null }) => {
    const name = q.clients && typeof q.clients === "object" && "name" in q.clients ? (q.clients as { name: string | null }).name : null;
    return {
      id: q.id,
      reference: q.reference ?? null,
      clientName: name ?? null,
      durationHours: Math.round((durationByQuote[q.id] ?? 0) * 100) / 100,
      total_ttc: Number(q.total_ttc) || 0,
    };
  });
}

export async function getPlanningAssignments(weekStart: string): Promise<PlanningAssignmentRow[]> {
  try {
    const garageId = await getCurrentGarageId();
    if (!garageId) return [];
    const supabase = await createClient();
    const days = getWeekDays(weekStart);
    const first = days[0];
    const last = days[days.length - 1];

    let query = supabase
      .from("planning_assignments")
      .select("id, quote_id, assignment_date, slot_label, status")
      .eq("garage_id", garageId)
      .gte("assignment_date", first)
      .lte("assignment_date", last)
      .order("assignment_date");

    const { data: rows, error } = await query;
    if (error) return [];

  const list = (rows ?? []) as PlanningAssignmentRow[];
  if (list.length === 0) return list;

  const quoteIds = [...new Set(list.map((r) => r.quote_id))];
  const { data: quotes } = await supabase
    .from("quotes")
    .select("id, reference")
    .in("id", quoteIds);
  const refMap = new Map<string, string | null>();
  for (const q of quotes ?? []) {
    refMap.set((q as { id: string }).id, (q as { reference: string | null }).reference ?? null);
  }

  const { data: items } = await supabase
    .from("quote_items")
    .select("quote_id, type, quantity")
    .in("quote_id", quoteIds);
  const durationByQuote: Record<string, number> = {};
  for (const it of items ?? []) {
    const qid = (it as { quote_id: string }).quote_id;
    const type = (it as { type?: string }).type;
    const qty = Number((it as { quantity?: number }).quantity) || 0;
    if (type === "labor") {
      durationByQuote[qid] = (durationByQuote[qid] ?? 0) + qty;
    }
  }

  return list.map((r) => ({
    ...r,
    reference: refMap.get(r.quote_id) ?? null,
    durationHours: Math.round((durationByQuote[r.quote_id] ?? 0) * 100) / 100,
  }));
  } catch {
    return [];
  }
}

export async function createPlanningAssignment(
  quoteId: string,
  assignmentDate: string,
  slotLabel: SlotLabel
): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé" };
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("garage_id", garageId)
    .single();
  if (!quote) return { error: "Devis introuvable" };

  const { error } = await supabase.from("planning_assignments").insert({
    garage_id: garageId,
    quote_id: quoteId,
    assignment_date: assignmentDate,
    slot_label: slotLabel,
    status: "confirmed",
  });
  if (error) return { error: error.message };
  return {};
}

export async function deletePlanningAssignment(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé" };
  const supabase = await createClient();

  const { error } = await supabase
    .from("planning_assignments")
    .delete()
    .eq("id", id)
    .eq("garage_id", garageId);
  if (error) return { error: error.message };
  return {};
}

export type QuoteWithPlannedAt = {
  id: string;
  reference: string | null;
  planned_at: string;
  clientName: string | null;
};

/** Devis avec date prévue (RDV) dans la semaine donnée. */
export async function getQuotesWithPlannedAtForWeek(weekStart: string): Promise<QuoteWithPlannedAt[]> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return [];
  const supabase = await createClient();
  const days = getWeekDays(weekStart);
  const first = days[0];
  const last = days[days.length - 1];

  let query = supabase
    .from("quotes")
    .select("id, reference, planned_at, clients(name)")
    .eq("garage_id", garageId)
    .not("planned_at", "is", null)
    .gte("planned_at", first)
    .lte("planned_at", last)
    .order("planned_at");
  const { data: rows, error } = await query;
  if (error) return [];

  return (rows ?? []).map((q: { id: string; reference: string | null; planned_at: string; clients?: { name: string | null } | null }) => ({
    id: q.id,
    reference: q.reference ?? null,
    planned_at: q.planned_at,
    clientName: q.clients && typeof q.clients === "object" && "name" in q.clients ? (q.clients as { name: string | null }).name : null,
  }));
}

/** Une intervention affichée sur l'écran "Aujourd'hui à l'atelier". */
export type TodayInterventionRow = {
  id: string;
  quote_id: string | null;
  task_id: string | null;
  reference: string | null;
  vehicleLabel: string | null;
  durationHours: number;
  status: "a_faire" | "en_retard" | "termine";
  clientName: string | null;
  clientPhone: string | null;
  planned_at: string | null;
  is_task: boolean;
};

/**
 * Agrège les interventions du jour : devis avec planned_at = aujourd'hui,
 * assignations planning du jour, et tâches garage à faire aujourd'hui.
 */
export async function getTodayInterventions(): Promise<TodayInterventionRow[]> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return [];

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();
  const seenQuoteIds = new Set<string>();
  const rows: TodayInterventionRow[] = [];

  // 1) Devis acceptés avec planned_at <= aujourd'hui (aujourd'hui + en retard) ; "terminé" si facture_number renseigné
  let queryQuotes = supabase
    .from("quotes")
    .select("id, reference, planned_at, facture_number, clients(name, phone), vehicles(brand, model, registration)")
    .eq("garage_id", garageId)
    .eq("status", "accepted")
    .is("archived_at", null)
    .not("planned_at", "is", null)
    .lte("planned_at", today)
    .order("planned_at", { ascending: true });

  const { data: plannedQuotes } = await queryQuotes;
  const quoteIds = (plannedQuotes ?? []).map((q: { id: string }) => q.id);
  let durationByQuote: Record<string, number> = {};
  if (quoteIds.length > 0) {
    const { data: items } = await supabase
      .from("quote_items")
      .select("quote_id, type, quantity")
      .in("quote_id", quoteIds);
    for (const it of items ?? []) {
      const qid = (it as { quote_id: string }).quote_id;
      const type = (it as { type?: string }).type;
      const qty = Number((it as { quantity?: number }).quantity) || 0;
      if (type === "labor") durationByQuote[qid] = (durationByQuote[qid] ?? 0) + qty;
    }
  }

  for (const q of plannedQuotes ?? []) {
    const plannedAt = (q as { planned_at?: string | null }).planned_at ?? null;
    const plannedDate = plannedAt ? plannedAt.slice(0, 10) : null;
    if (!plannedDate || plannedDate > today) continue;
    const factureNumber = (q as { facture_number?: string | null }).facture_number;
    const isTermine = !!factureNumber?.trim();
    const clients = (q as { clients?: { name?: string | null; phone?: string | null } | null }).clients;
    const vehicles = (q as { vehicles?: { brand?: string | null; model?: string | null; registration?: string | null } | null }).vehicles;
    const clientName = clients && typeof clients === "object" && "name" in clients ? (clients as { name?: string | null }).name ?? null : null;
    const clientPhone = clients && typeof clients === "object" && "phone" in clients ? (clients as { phone?: string | null }).phone ?? null : null;
    const v = vehicles && typeof vehicles === "object" ? vehicles as { brand?: string | null; model?: string | null; registration?: string | null } : null;
    const vehicleLabel = v ? [v.brand, v.model].filter(Boolean).join(" ") || v.registration || null : null;
    const durationHours = Math.round((durationByQuote[(q as { id: string }).id] ?? 0) * 100) / 100;
    const status: "a_faire" | "en_retard" | "termine" = isTermine ? "termine" : plannedDate < today ? "en_retard" : "a_faire";
    seenQuoteIds.add((q as { id: string }).id);
    rows.push({
      id: (q as { id: string }).id,
      quote_id: (q as { id: string }).id,
      task_id: null,
      reference: (q as { reference?: string | null }).reference ?? null,
      vehicleLabel,
      durationHours,
      status,
      clientName,
      clientPhone,
      planned_at: plannedAt,
      is_task: false,
    });
  }

  // 2) Assignations planning pour aujourd'hui (devis pas déjà dans la liste)
  const weekStart = getMondayOfWeek(new Date());
  const assignmentsAll = await getPlanningAssignments(weekStart);
  const assignments = assignmentsAll.filter((a) => a.assignment_date === today);
  for (const a of assignments) {
    if (seenQuoteIds.has(a.quote_id)) continue;
    seenQuoteIds.add(a.quote_id);
    const { data: quote } = await supabase
      .from("quotes")
      .select("id, reference, planned_at, facture_number, clients(name, phone), vehicles(brand, model, registration)")
      .eq("id", a.quote_id)
      .eq("garage_id", garageId)
      .single();
    if (!quote) continue;
    const factureNumber = (quote as { facture_number?: string | null }).facture_number;
    const isTermine = !!factureNumber?.trim();
    const clients = (quote as { clients?: { name?: string | null; phone?: string | null } | null }).clients;
    const vehicles = (quote as { vehicles?: { brand?: string | null; model?: string | null; registration?: string | null } | null }).vehicles;
    const clientName = clients && typeof clients === "object" && "name" in clients ? (clients as { name?: string | null }).name ?? null : null;
    const clientPhone = clients && typeof clients === "object" && "phone" in clients ? (clients as { phone?: string | null }).phone ?? null : null;
    const v = vehicles && typeof vehicles === "object" ? vehicles as { brand?: string | null; model?: string | null; registration?: string | null } : null;
    const vehicleLabel = v ? [v.brand, v.model].filter(Boolean).join(" ") || v.registration || null : null;
    const plannedAt = (quote as { planned_at?: string | null }).planned_at ?? null;
    const plannedDate = plannedAt ? plannedAt.slice(0, 10) : null;
    const status: "a_faire" | "en_retard" | "termine" = isTermine ? "termine" : plannedDate && plannedDate < today ? "en_retard" : "a_faire";
    rows.push({
      id: a.id,
      quote_id: a.quote_id,
      task_id: null,
      reference: a.reference ?? (quote as { reference?: string | null }).reference ?? null,
      vehicleLabel,
      durationHours: a.durationHours ?? 0,
      status,
      clientName,
      clientPhone,
      planned_at: plannedAt,
      is_task: false,
    });
  }

  // 3) Tâches garage avec due_date = aujourd'hui (non terminées en priorité)
  const { data: tasks } = await supabase
    .from("garage_tasks")
    .select("id, title, due_date, done, quote_id")
    .eq("garage_id", garageId)
    .eq("due_date", today)
    .order("done", { ascending: true })
    .order("created_at", { ascending: false });
  for (const t of tasks ?? []) {
    const row = t as { id: string; title: string; due_date: string | null; done: boolean; quote_id: string | null };
    rows.push({
      id: row.id,
      quote_id: row.quote_id,
      task_id: row.id,
      reference: row.title,
      vehicleLabel: null,
      durationHours: 0,
      status: row.done ? "termine" : "a_faire",
      clientName: null,
      clientPhone: null,
      planned_at: row.due_date,
      is_task: true,
    });
  }

  // 4) À planifier : devis acceptés sans planned_at (tri par priorité / ancienneté)
  const { data: acceptedNoDate } = await supabase
    .from("quotes")
    .select("id, reference, created_at, clients(name, phone), vehicles(brand, model, registration)")
    .eq("garage_id", garageId)
    .eq("status", "accepted")
    .is("archived_at", null)
    .is("planned_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  for (const q of acceptedNoDate ?? []) {
    const qid = (q as { id: string }).id;
    if (seenQuoteIds.has(qid)) continue;
    seenQuoteIds.add(qid);
    const { data: items } = await supabase
      .from("quote_items")
      .select("quote_id, type, quantity")
      .eq("quote_id", qid);
    let durationHours = 0;
    for (const it of items ?? []) {
      const type = (it as { type?: string }).type;
      const qty = Number((it as { quantity?: number }).quantity) || 0;
      if (type === "labor") durationHours += qty;
    }
    durationHours = Math.round(durationHours * 100) / 100;
    const clients = (q as { clients?: { name?: string | null; phone?: string | null } | null }).clients;
    const vehicles = (q as { vehicles?: { brand?: string | null; model?: string | null; registration?: string | null } | null }).vehicles;
    const clientName = clients && typeof clients === "object" && "name" in clients ? (clients as { name?: string | null }).name ?? null : null;
    const clientPhone = clients && typeof clients === "object" && "phone" in clients ? (clients as { phone?: string | null }).phone ?? null : null;
    const v = vehicles && typeof vehicles === "object" ? vehicles as { brand?: string | null; model?: string | null; registration?: string | null } : null;
    const vehicleLabel = v ? [v.brand, v.model].filter(Boolean).join(" ") || v.registration || null : null;
    rows.push({
      id: qid,
      quote_id: qid,
      task_id: null,
      reference: (q as { reference?: string | null }).reference ?? null,
      vehicleLabel,
      durationHours,
      status: "a_faire",
      clientName,
      clientPhone,
      planned_at: null,
      is_task: false,
    });
  }

  // Tri : En retard d'abord, puis À faire, puis Terminé
  const order: Record<"a_faire" | "en_retard" | "termine", number> = { en_retard: 0, a_faire: 1, termine: 2 };
  rows.sort((a, b) => {
    const o = order[a.status] - order[b.status];
    if (o !== 0) return o;
    if (a.planned_at && b.planned_at) return a.planned_at.localeCompare(b.planned_at);
    return 0;
  });

  return rows;
}

/** Calcule la durée MO (heures) d'un devis à partir de ses quote_items. */
export async function getQuoteDurationHours(quoteId: string): Promise<number | null> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  let query = supabase.from("quotes").select("id").eq("id", quoteId);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: quote } = await query.single();
  if (!quote) return null;
  const { data: items } = await supabase
    .from("quote_items")
    .select("type, quantity")
    .eq("quote_id", quoteId);
  let hours = 0;
  for (const it of items ?? []) {
    const type = (it as { type?: string }).type;
    const qty = Number((it as { quantity?: number }).quantity) || 0;
    if (type === "labor") hours += qty;
  }
  return Math.round(hours * 100) / 100;
}
