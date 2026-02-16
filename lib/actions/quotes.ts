"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentGarageId } from "./garage";
import type { SuggestedQuoteLine } from "@/lib/ai/quick-note-types";
import { isPriceMemoryEnabled, normalizeKey, upsertPriceMemory } from "@/lib/price-memory";
import type { PriceBookItemType } from "@/lib/price-memory";

export type DashboardStats = {
  totalAmount: number;
  quotesThisMonth: number;
  pendingCount: number;
  acceptedThisMonth: number;
  /** Nombre de brouillons ce mois */
  draftCountThisMonth: number;
  /** Total TTC des devis acceptés ce mois */
  totalAcceptedTtcThisMonth: number;
  /** CA du mois précédent (pour variation) */
  previousMonthAmount: number;
  /** Devis créés la semaine précédente (pour évolution) */
  quotesLastWeek: number;
  /** CA semaine précédente (7 derniers jours avant aujourd'hui) */
  totalAcceptedTtcLastWeek: number;
  /** Montant total des devis en attente (draft + sent) */
  pendingAmount: number;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("quotes").select("id, status, total_ttc, created_at").is("archived_at", null);
  if (garageId) query = query.eq("garage_id", garageId);

  let result = await query;
  if (result.error && (result.error.message?.includes("archived_at") || result.error.message?.includes("does not exist"))) {
    query = supabase.from("quotes").select("id, status, total_ttc, created_at");
    if (garageId) query = query.eq("garage_id", garageId);
    result = await query;
  }
  const { data: quotes, error } = result;
  if (error) {
    return {
      totalAmount: 0,
      quotesThisMonth: 0,
      pendingCount: 0,
      acceptedThisMonth: 0,
      draftCountThisMonth: 0,
      totalAcceptedTtcThisMonth: 0,
      previousMonthAmount: 0,
      quotesLastWeek: 0,
      totalAcceptedTtcLastWeek: 0,
      pendingAmount: 0,
    };
  }

  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const firstDayPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  let totalAmount = 0;
  let quotesThisMonth = 0;
  let pendingCount = 0;
  let acceptedThisMonth = 0;
  let draftCountThisMonth = 0;
  let totalAcceptedTtcThisMonth = 0;
  let previousMonthAmount = 0;
  let quotesLastWeek = 0;
  let totalAcceptedTtcLastWeek = 0;
  let pendingAmount = 0;

  for (const q of quotes ?? []) {
    const amount = Number(q.total_ttc) || 0;
    const created = new Date(q.created_at);
    if (q.status === "accepted") {
      totalAmount += amount;
      if (created >= firstDayOfMonth) {
        acceptedThisMonth += 1;
        totalAcceptedTtcThisMonth += amount;
      }
      if (created >= firstDayPreviousMonth && created < firstDayOfMonth) {
        previousMonthAmount += amount;
      }
      if (created >= sevenDaysAgo && created < now) {
        totalAcceptedTtcLastWeek += amount;
      }
    }
    if (created >= firstDayOfMonth) {
      quotesThisMonth += 1;
      if (q.status === "draft") draftCountThisMonth += 1;
    }
    if (created >= fourteenDaysAgo && created < sevenDaysAgo) {
      quotesLastWeek += 1;
    }
    if (q.status === "draft" || q.status === "sent") {
      pendingCount += 1;
      pendingAmount += amount;
    }
  }

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    quotesThisMonth,
    pendingCount,
    acceptedThisMonth,
    draftCountThisMonth,
    totalAcceptedTtcThisMonth: Math.round(totalAcceptedTtcThisMonth * 100) / 100,
    previousMonthAmount: Math.round(previousMonthAmount * 100) / 100,
    quotesLastWeek,
    totalAcceptedTtcLastWeek: Math.round(totalAcceptedTtcLastWeek * 100) / 100,
    pendingAmount: Math.round(pendingAmount * 100) / 100,
  };
}

/** Statuts devis (UI + mapping interne). "refused" = autre en base. */
export type QuoteStatus = "draft" | "sent" | "accepted" | "refused" | "other";

export type QuoteActivityPoint = {
  label: string;
  draft: number;
  sent: number;
  accepted: number;
  other: number;
  /** Montants TTC par statut (pour mode Montant). */
  draft_ttc: number;
  sent_ttc: number;
  accepted_ttc: number;
  other_ttc: number;
};

export type QuoteActivityRange = "week" | "30days" | "current_month" | "year";

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_NAMES = ["Janv", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

function emptyPoint(label: string): QuoteActivityPoint {
  return {
    label,
    draft: 0,
    sent: 0,
    accepted: 0,
    other: 0,
    draft_ttc: 0,
    sent_ttc: 0,
    accepted_ttc: 0,
    other_ttc: 0,
  };
}

/** Agrégats par période pour le graphique Activité devis (volume + montants TTC). */
export async function getQuoteActivityForChart(
  range: QuoteActivityRange
): Promise<QuoteActivityPoint[]> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  const now = new Date();
  const buckets: { key: string; label: string; start: Date; end: Date }[] = [];

  if (range === "week") {
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 6);
    rangeStart.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      if (end > now) end.setTime(now.getTime());
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: DAY_NAMES[d.getDay()] + " " + d.getDate(),
        start: new Date(d),
        end,
      });
    }
  } else if (range === "30days") {
    const rangeStart = new Date(now);
    rangeStart.setDate(rangeStart.getDate() - 29);
    rangeStart.setHours(0, 0, 0, 0);
    for (let i = 0; i < 30; i++) {
      const d = new Date(rangeStart);
      d.setDate(d.getDate() + i);
      const end = new Date(d);
      end.setHours(23, 59, 59, 999);
      if (end > now) end.setTime(now.getTime());
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: DAY_NAMES[d.getDay()] + " " + d.getDate(),
        start: new Date(d),
        end,
      });
    }
  } else if (range === "current_month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    for (let day = 1; day <= lastDay; day++) {
      const start = new Date(now.getFullYear(), now.getMonth(), day, 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), day, 23, 59, 59, 999);
      if (end > now) break;
      buckets.push({
        key: start.toISOString().slice(0, 10),
        label: String(day),
        start,
        end,
      });
    }
  } else {
    const rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    for (let i = 0; i < 12; i++) {
      const start = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999);
      buckets.push({
        key: start.getFullYear() + "-" + String(start.getMonth() + 1).padStart(2, "0"),
        label: MONTH_NAMES[start.getMonth()] + " " + start.getFullYear(),
        start,
        end,
      });
    }
  }

  if (buckets.length === 0) return [];

  const from = buckets[0].start.toISOString().slice(0, 19).replace("T", " ");
  const to = buckets[buckets.length - 1].end.toISOString().slice(0, 19).replace("T", " ");

  let query = supabase
    .from("quotes")
    .select("id, status, created_at, total_ttc")
    .is("archived_at", null)
    .gte("created_at", from)
    .lte("created_at", to);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: quotes, error } = await query;
  if (error) return buckets.map((b) => emptyPoint(b.label));

  const points: QuoteActivityPoint[] = buckets.map((b) => emptyPoint(b.label));

  for (const q of quotes ?? []) {
    const created = new Date(q.created_at);
    const status = (q.status === "draft" || q.status === "sent" || q.status === "accepted" ? q.status : "other") as "draft" | "sent" | "accepted" | "other";
    const amount = Number((q as { total_ttc?: number }).total_ttc) || 0;
    const idx = buckets.findIndex((b) => created >= b.start && created <= b.end);
    if (idx < 0) continue;
    if (status === "draft") {
      points[idx].draft += 1;
      points[idx].draft_ttc += amount;
    } else if (status === "sent") {
      points[idx].sent += 1;
      points[idx].sent_ttc += amount;
    } else if (status === "accepted") {
      points[idx].accepted += 1;
      points[idx].accepted_ttc += amount;
    } else {
      points[idx].other += 1;
      points[idx].other_ttc += amount;
    }
  }

  return points;
}

export async function getRecentQuotes(limit = 10) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("id, reference, status, total_ttc, valid_until, created_at, clients(name), vehicles(registration, brand, model)")
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (garageId) query = query.eq("garage_id", garageId);

  let { data, error } = await query;
  if (error && (error.message?.includes("archived_at") || error.message?.includes("does not exist"))) {
    query = supabase.from("quotes").select("id, reference, status, total_ttc, valid_until, created_at, clients(name), vehicles(registration, brand, model)").order("created_at", { ascending: false }).limit(limit);
    if (garageId) query = query.eq("garage_id", garageId);
    const fallback = await query;
    error = fallback.error;
    data = fallback.data;
  }
  if (error) return [];
  return data ?? [];
}

export async function getExpiredQuotesToProcess(limit = 10) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  let query = supabase
    .from("quotes")
    .select("id, reference, valid_until, created_at, clients(name)")
    .is("archived_at", null)
    .eq("status", "sent")
    .lt("valid_until", today)
    .order("valid_until", { ascending: true })
    .limit(limit);
  if (garageId) query = query.eq("garage_id", garageId);

  let { data, error } = await query;
  if (error && (error.message?.includes("archived_at") || error.message?.includes("does not exist"))) {
    query = supabase.from("quotes").select("id, reference, valid_until, created_at, clients(name)").eq("status", "sent").lt("valid_until", today).order("valid_until", { ascending: true }).limit(limit);
    if (garageId) query = query.eq("garage_id", garageId);
    const fallback = await query;
    error = fallback.error;
    data = fallback.data;
  }
  if (error) return [];
  return data ?? [];
}

function formatExpiredSince(validUntil: string | null): string {
  if (!validUntil) return "Expiré";
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.floor(
    (new Date(today).getTime() - new Date(validUntil).getTime()) / (24 * 60 * 60 * 1000)
  );
  if (days <= 0) return "Expiré";
  return days === 1 ? "Expiré depuis 1 j." : `Expiré depuis ${days} j.`;
}

export { formatExpiredSince };

export type QuoteToProcessItem = {
  id: string;
  reference: string | null;
  status: string;
  valid_until: string | null;
  created_at: string;
  clients: { name: string | null } | null;
};

/** À traiter aujourd'hui : expirés (sent + valid_until < today), à relancer (sent + envoyé > 3j), à finaliser (draft > 2j). Sans changer le schéma (created_at utilisé comme proxy pour date envoi). */
export async function getQuotesToProcessToday(): Promise<{
  expired: QuoteToProcessItem[];
  toRelance: QuoteToProcessItem[];
  toFinalize: QuoteToProcessItem[];
}> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  let query = supabase
    .from("quotes")
    .select("id, reference, status, valid_until, created_at, clients(name)")
    .in("status", ["sent", "draft"])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  if (garageId) query = query.eq("garage_id", garageId);

  let { data: quotes, error } = await query;
  if (error && (error.message?.includes("archived_at") || error.message?.includes("does not exist"))) {
    query = supabase.from("quotes").select("id, reference, status, valid_until, created_at, clients(name)").in("status", ["sent", "draft"]).order("created_at", { ascending: false }).limit(80);
    if (garageId) query = query.eq("garage_id", garageId);
    const fallback = await query;
    error = fallback.error;
    quotes = fallback.data;
  }
  if (error || !quotes) return { expired: [], toRelance: [], toFinalize: [] };

  const expired: QuoteToProcessItem[] = [];
  const toRelance: QuoteToProcessItem[] = [];
  const toFinalize: QuoteToProcessItem[] = [];

  for (const q of quotes as unknown as (QuoteToProcessItem & { valid_until?: string | null })[]) {
    const created = new Date(q.created_at);
    const validUntil = q.valid_until ?? null;
    if (q.status === "sent") {
      if (validUntil && validUntil < today) {
        if (expired.length < 5) expired.push(q);
      } else if (created < threeDaysAgo) {
        if (toRelance.length < 5) toRelance.push(q);
      }
    } else if (q.status === "draft" && created < twoDaysAgo) {
      if (toFinalize.length < 5) toFinalize.push(q);
    }
  }

  return { expired, toRelance, toFinalize };
}

export type TodayTaskType = "expired" | "expiring_soon" | "relance" | "finalize";

export type TodayTaskItem = {
  id: string;
  reference: string | null;
  status: string;
  valid_until: string | null;
  created_at: string;
  client_id: string;
  total_ttc?: number;
  clients: { name: string | null } | null;
  taskType: TodayTaskType;
  priorityScore: number;
  clientChaud: boolean;
};

const BASE_SCORE: Record<TodayTaskType, number> = {
  expired: 95,
  expiring_soon: 85,
  relance: 70,
  finalize: 50,
};
const CLIENT_CHAUD_BONUS = 10;

/** Tâches "À faire aujourd'hui" : priorisées par score (expirés, proches expiration, à relancer, brouillons anciens + bonus client chaud). */
export async function getTodayTasksWithPriority(limit = 5): Promise<TodayTaskItem[]> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  let query = supabase
    .from("quotes")
    .select("id, client_id, reference, status, valid_until, total_ttc, created_at, clients(name)")
    .in("status", ["sent", "draft"])
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  if (garageId) query = query.eq("garage_id", garageId);

  let { data: quotes, error } = await query;
  if (error && (error.message?.includes("archived_at") || error.message?.includes("does not exist"))) {
    query = supabase
      .from("quotes")
      .select("id, client_id, reference, status, valid_until, total_ttc, created_at, clients(name)")
      .in("status", ["sent", "draft"])
      .order("created_at", { ascending: false })
      .limit(80);
    if (garageId) query = query.eq("garage_id", garageId);
    const fallback = await query;
    error = fallback.error;
    quotes = fallback.data;
  }
  if (error || !quotes) return [];

  const clientIds = Array.from(new Set((quotes as { client_id?: string }[]).map((q) => q.client_id).filter(Boolean))) as string[];
  let acceptedClientIds = new Set<string>();
  if (garageId && clientIds.length > 0) {
    const { data: accepted } = await supabase
      .from("quotes")
      .select("client_id")
      .eq("garage_id", garageId)
      .eq("status", "accepted")
      .in("client_id", clientIds);
    if (accepted) acceptedClientIds = new Set(accepted.map((r: { client_id: string }) => r.client_id));
  }

  const tasks: TodayTaskItem[] = [];
  const seenIds = new Set<string>();

  type QuoteRow = { id: string; client_id?: string; reference?: string | null; status: string; valid_until?: string | null; created_at: string; total_ttc?: number; clients?: { name: string | null } | null };
  for (const q of quotes as unknown as QuoteRow[]) {
    if (seenIds.has(q.id)) continue;
    const created = new Date(q.created_at);
    const validUntil = q.valid_until ?? null;
    let taskType: TodayTaskType | null = null;

    if (q.status === "sent") {
      if (validUntil && validUntil < today) taskType = "expired";
      else if (validUntil && validUntil >= today && validUntil <= sevenDaysLater) taskType = "expiring_soon";
      else if (created < threeDaysAgo) taskType = "relance";
    } else if (q.status === "draft" && created < twoDaysAgo) {
      taskType = "finalize";
    }

    if (!taskType) continue;
    seenIds.add(q.id);
    const clientChaud = q.client_id ? acceptedClientIds.has(q.client_id) : false;
    let score = BASE_SCORE[taskType] + (clientChaud ? CLIENT_CHAUD_BONUS : 0);
    score = Math.min(100, score);

    tasks.push({
      id: q.id,
      reference: q.reference ?? null,
      status: q.status,
      valid_until: q.valid_until ?? null,
      created_at: q.created_at,
      client_id: q.client_id ?? "",
      total_ttc: q.total_ttc,
      clients: q.clients ?? null,
      taskType,
      priorityScore: score,
      clientChaud,
    });
  }

  tasks.sort((a, b) => b.priorityScore - a.priorityScore);
  return tasks.slice(0, limit);
}

export type QuoteListFilters = {
  status?: string;
  q?: string;
  period?: "all" | "this_month" | "last_30";
  expired?: boolean;
  toRelance?: boolean;
  /** true = archivés uniquement, false/undefined = actifs */
  archived?: boolean;
  /** "not_null" = uniquement les devis avec un numéro de facture (vue Factures) */
  facture_number?: string;
};

export type QuoteListItem = {
  id: string;
  client_id: string;
  vehicle_id: string | null;
  status: string;
  reference: string | null;
  valid_until: string | null;
  total_ttc: number;
  created_at: string;
  archived_at: string | null;
  clients: { name: string | null } | null;
  vehicles: { registration: string | null; brand?: string | null; model?: string | null } | null;
};

export async function getQuotes(filters?: QuoteListFilters): Promise<QuoteListItem[]> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("id, client_id, vehicle_id, status, reference, valid_until, total_ttc, created_at, archived_at, facture_number, clients(name), vehicles(registration, brand, model)")
    .order("created_at", { ascending: false });
  if (garageId) query = query.eq("garage_id", garageId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.facture_number === "not_null") query = query.not("facture_number", "is", null);
  if (filters?.archived === true) query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);

  const result = await query;
  let list: QuoteListItem[] = [];
  if (result.error && (result.error.message?.includes("archived_at") || result.error.message?.includes("does not exist") || result.error.message?.includes("facture_number"))) {
    let fallbackQuery = supabase
      .from("quotes")
      .select("id, client_id, vehicle_id, status, reference, valid_until, total_ttc, created_at, facture_number, clients(name), vehicles(registration, brand, model)")
      .order("created_at", { ascending: false });
    if (garageId) fallbackQuery = fallbackQuery.eq("garage_id", garageId);
    if (filters?.status) fallbackQuery = fallbackQuery.eq("status", filters.status);
    if (filters?.facture_number === "not_null") fallbackQuery = fallbackQuery.not("facture_number", "is", null);
    const fallback = await fallbackQuery;
    if (fallback.error) return [];
    list = (fallback.data ?? []).map((q) => ({ ...q, archived_at: null as string | null })) as unknown as QuoteListItem[];
  } else if (!result.error && result.data) {
    list = result.data.map((q) => ({ ...q, archived_at: (q as { archived_at?: string | null }).archived_at ?? null })) as unknown as QuoteListItem[];
  }
  if (result.error && list.length === 0) return [];

  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (filters?.period === "this_month") {
    list = list.filter((q) => new Date(q.created_at) >= firstDayMonth);
  } else if (filters?.period === "last_30") {
    list = list.filter((q) => new Date(q.created_at) >= thirtyDaysAgo);
  }

  if (filters?.expired) {
    list = list.filter((q) => q.status === "sent" && q.valid_until && q.valid_until < today);
  }
  if (filters?.toRelance) {
    list = list.filter(
      (q) =>
        q.status === "sent" &&
        q.valid_until &&
        q.valid_until >= today &&
        q.valid_until <= sevenDaysLater.toISOString().slice(0, 10)
    );
  }

  if (filters?.q?.trim()) {
    const term = filters.q.trim().toLowerCase();
    list = list.filter((q) => {
      const ref = (q.reference ?? "").toLowerCase();
      const clientName = q.clients && typeof q.clients === "object" && "name" in q.clients ? String((q.clients as { name: string | null }).name ?? "").toLowerCase() : "";
      const v = q.vehicles;
      const reg = v && typeof v === "object" && "registration" in v ? String((v as { registration: string | null }).registration ?? "").toLowerCase() : "";
      const brand = v && typeof v === "object" && "brand" in v ? String((v as { brand: string | null }).brand ?? "").toLowerCase() : "";
      const model = v && typeof v === "object" && "model" in v ? String((v as { model: string | null }).model ?? "").toLowerCase() : "";
      return ref.includes(term) || clientName.includes(term) || reg.includes(term) || brand.includes(term) || model.includes(term);
    });
  }
  return list;
}

export async function getQuoteById(id: string) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("*, clients(id, name), vehicles(id, registration, brand, model)")
    .eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);

  const { data: quote, error } = await query.single();
  if (error || !quote) return null;

  const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", id).order("created_at");
  return { ...quote, items: items ?? [] };
}

export async function getQuotesByClientId(clientId: string) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, created_at, vehicles(registration, brand, model)")
    .eq("client_id", clientId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (garageId) query = query.eq("garage_id", garageId);

  let { data, error } = await query;
  if (error && (error.message?.includes("archived_at") || error.message?.includes("does not exist"))) {
    query = supabase.from("quotes").select("id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, created_at, vehicles(registration, brand, model)").eq("client_id", clientId).order("created_at", { ascending: false });
    if (garageId) query = query.eq("garage_id", garageId);
    const fallback = await query;
    error = fallback.error;
    data = fallback.data;
  }
  if (error) return [];
  return data ?? [];
}

export async function getQuotesByVehicleId(vehicleId: string) {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, created_at, clients(name)")
    .eq("vehicle_id", vehicleId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });
  if (garageId) query = query.eq("garage_id", garageId);

  let { data, error } = await query;
  if (error && (error.message?.includes("archived_at") || error.message?.includes("does not exist"))) {
    query = supabase.from("quotes").select("id, client_id, vehicle_id, status, reference, valid_until, total_ht, total_ttc, created_at, clients(name)").eq("vehicle_id", vehicleId).order("created_at", { ascending: false });
    if (garageId) query = query.eq("garage_id", garageId);
    const fallback = await query;
    error = fallback.error;
    data = fallback.data;
  }
  if (error) return [];
  return data ?? [];
}

export async function createQuoteAction(_prev: unknown, formData: FormData) {
  const { redirect } = await import("next/navigation");
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  const clientId = formData.get("client_id") as string;
  if (!clientId) return { error: "Le client est obligatoire." };

  const vehicleId = (formData.get("vehicle_id") as string)?.trim() || null;
  const reference = (formData.get("reference") as string)?.trim() || null;

  const payload: {
    client_id: string;
    vehicle_id: string | null;
    status: string;
    reference: string | null;
    total_ht: number;
    total_ttc: number;
    garage_id?: string;
  } = {
    client_id: clientId,
    vehicle_id: vehicleId,
    status: "draft",
    reference: reference,
    total_ht: 0,
    total_ttc: 0,
  };
  if (garageId) payload.garage_id = garageId;

  const { data, error } = await supabase.from("quotes").insert(payload).select("id").single();
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("garage_id") || msg.includes("policy") || msg.includes("row-level"))
      return { error: "Erreur d'accès. Vérifiez les politiques RLS Supabase et qu'un garage existe (Paramètres)." };
    return { error: error.message };
  }
  redirect(`/dashboard/devis/${data.id}`);
}

export async function createQuoteFromSuggestedLines(
  clientId: string,
  vehicleId: string | null,
  lines: SuggestedQuoteLine[]
): Promise<{ error?: string }> {
  const { redirect } = await import("next/navigation");
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  if (!garageId) return { error: "Non autorisé." };
  if (!clientId || lines.length === 0) return { error: "Client et au moins une ligne requis." };

  const payload = {
    client_id: clientId,
    vehicle_id: vehicleId,
    status: "draft",
    reference: null as string | null,
    total_ht: 0,
    total_ttc: 0,
    garage_id: garageId,
  };
  const { data: quote, error: insertErr } = await supabase.from("quotes").insert(payload).select("id").single();
  if (insertErr || !quote) return { error: insertErr?.message ?? "Erreur création devis." };

  const items: QuoteItemPayload[] = lines.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit_price: l.unit_price,
    total: Math.round(l.quantity * l.unit_price * 100) / 100,
    type: l.type,
  }));
  const err = await saveQuoteItemsAction(quote.id, items);
  if (err.error) return err;
  redirect(`/dashboard/devis/${quote.id}`);
  return {};
}

export async function duplicateQuoteAction(quoteId: string): Promise<string | null> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("quotes").select("*").eq("id", quoteId);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: quote, error: fetchErr } = await query.single();
  if (fetchErr || !quote) return null;

  const { data: items } = await supabase.from("quote_items").select("*").eq("quote_id", quoteId).order("created_at");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit keys for insert
  const { id: _id, created_at: _c, updated_at: _u, archived_at: _a, archived_by: _ab, ...rest } = quote as Record<string, unknown>;
  const newPayload = { ...rest, status: "draft", reference: null, total_ht: 0, total_ttc: 0, archived_at: null, archived_by: null };
  if (garageId) (newPayload as Record<string, unknown>).garage_id = garageId;

  const { data: newQuote, error: insertErr } = await supabase
    .from("quotes")
    .insert(newPayload)
    .select("id")
    .single();
  if (insertErr || !newQuote) return null;

  if (items && items.length > 0 && garageId) {
    const newItems = items.map((it: Record<string, unknown>) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- omit keys for insert
      const { id: _i, quote_id: _q, created_at: _c2, ...itemRest } = it;
      return { ...itemRest, quote_id: newQuote.id, garage_id: garageId };
    });
    await supabase.from("quote_items").insert(newItems);
  }
  return newQuote.id;
}

export async function deleteQuoteAction(quoteId: string): Promise<boolean> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  if (garageId) {
    const { data: q } = await supabase.from("quotes").select("id").eq("id", quoteId).eq("garage_id", garageId).single();
    if (!q) return false;
  }
  await supabase.from("quote_items").delete().eq("quote_id", quoteId);
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  return !error;
}

export async function archiveDevis(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase.from("quotes").select("id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Devis non trouvé." };

  const { error } = await supabase
    .from("quotes")
    .update({ archived_at: new Date().toISOString(), archived_by: user?.id ?? null })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function restoreDevis(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("quotes").select("id").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Devis non trouvé." };

  const { error } = await supabase
    .from("quotes")
    .update({ archived_at: null, archived_by: null })
    .eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export async function hardDeleteDevis(id: string): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("quotes").select("id, status").eq("id", id);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: row, error: fetchErr } = await query.single();
  if (fetchErr || !row) return { error: "Devis non trouvé." };
  if ((row as { status?: string }).status !== "draft") {
    return { error: "La suppression définitive n'est autorisée que pour les devis au statut Brouillon." };
  }

  await supabase.from("quote_items").delete().eq("quote_id", id);
  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) return { error: error.message };
  return {};
}

export type QuoteUpdatePayload = {
  client_id?: string;
  vehicle_id?: string | null;
  status?: string;
  valid_until?: string | null;
  reference?: string | null;
  notes?: string | null;
  notes_client?: string | null;
  total_ht?: number;
  total_ttc?: number;
  facture_number?: string | null;
  planned_at?: string | null;
  payment_status?: "unpaid" | "partial" | "paid" | null;
};

/** Retourne le numéro de facture du devis (créé si besoin). Réservé aux devis acceptés. */
export async function getOrCreateQuoteFactureNumber(quoteId: string): Promise<{ factureNumber?: string; error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  let query = supabase.from("quotes").select("id, reference, facture_number, status").eq("id", quoteId);
  if (garageId) query = query.eq("garage_id", garageId);
  const { data: q, error: fetchErr } = await query.single();
  if (fetchErr || !q) return { error: "Devis non trouvé." };
  const row = q as { id: string; reference?: string | null; facture_number?: string | null; status?: string };
  if (row.status !== "accepted") return { error: "Seuls les devis acceptés peuvent être transformés en facture." };
  if (row.facture_number?.trim()) return { factureNumber: row.facture_number.trim() };

  const factureNumber = "F-" + (row.reference?.trim() || row.id.slice(0, 8));
  const { error: updateErr } = await supabase.from("quotes").update({ facture_number: factureNumber }).eq("id", quoteId);
  if (updateErr) return { error: updateErr.message };
  return { factureNumber };
}

/** Génère automatiquement les numéros de facture pour tous les devis acceptés qui n'en ont pas encore */
export async function generateMissingFactureNumbers(): Promise<{ count: number; error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  // Trouver tous les devis acceptés sans numéro de facture
  let query = supabase
    .from("quotes")
    .select("id, reference")
    .eq("status", "accepted")
    .is("facture_number", null);
  
  if (garageId) query = query.eq("garage_id", garageId);
  
  const { data: quotes, error } = await query;
  
  if (error) {
    // Si la colonne facture_number n'existe pas, essayer sans ce filtre
    let fallbackQuery = supabase
      .from("quotes")
      .select("id, reference")
      .eq("status", "accepted");
    if (garageId) fallbackQuery = fallbackQuery.eq("garage_id", garageId);
    const fallback = await fallbackQuery;
    if (fallback.error) return { count: 0, error: fallback.error.message };
    
    // Filtrer côté client les devis sans facture_number
    const quotesWithoutFacture = (fallback.data ?? []).filter((q: any) => !q.facture_number);
    if (quotesWithoutFacture.length === 0) return { count: 0 };
    
    // Générer les numéros pour ces devis
    let updated = 0;
    for (const q of quotesWithoutFacture) {
      const factureNumber = "F-" + ((q as { reference?: string | null }).reference?.trim() || (q as { id: string }).id.slice(0, 8));
      const { error: updateErr } = await supabase
        .from("quotes")
        .update({ facture_number: factureNumber })
        .eq("id", (q as { id: string }).id);
      if (!updateErr) updated++;
    }
    return { count: updated };
  }

  if (!quotes || quotes.length === 0) return { count: 0 };

  // Générer les numéros de facture pour chaque devis
  let updated = 0;
  for (const q of quotes) {
    const row = q as { id: string; reference?: string | null };
    const factureNumber = "F-" + (row.reference?.trim() || row.id.slice(0, 8));
    const { error: updateErr } = await supabase
      .from("quotes")
      .update({ facture_number: factureNumber })
      .eq("id", row.id);
    if (!updateErr) updated++;
  }

  return { count: updated };
}

export async function updateQuoteAction(quoteId: string, payload: QuoteUpdatePayload): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  if (garageId) {
    const { data: q } = await supabase.from("quotes").select("id").eq("id", quoteId).eq("garage_id", garageId).single();
    if (!q) return { error: "Devis non trouvé." };
  }

  // Ne garder que les champs définis (évite d'envoyer undefined à Supabase / erreur schema cache)
  const keys = ["client_id", "vehicle_id", "status", "valid_until", "reference", "notes", "notes_client", "total_ht", "total_ttc", "facture_number", "planned_at", "payment_status"] as const;
  const cleanPayload: Record<string, unknown> = {};
  for (const k of keys) {
    const v = payload[k];
    if (v !== undefined) cleanPayload[k] = v;
  }

  let { error } = await supabase.from("quotes").update(cleanPayload).eq("id", quoteId);
  // Si erreur "schema cache" ou colonne manquante (notes, notes_client), réessayer sans ces champs
  if (error && (error.message?.toLowerCase().includes("schema cache") || error.message?.toLowerCase().includes("notes") || error.message?.toLowerCase().includes("does not exist"))) {
    delete cleanPayload.notes;
    delete cleanPayload.notes_client;
    const retry = await supabase.from("quotes").update(cleanPayload).eq("id", quoteId);
    error = retry.error;
  }
  if (error) return { error: error.message };
  return {};
}

export type QuoteItemPayload = {
  description?: string;
  quantity?: number;
  unit_price?: number;
  total?: number;
  type?: string;
  optional?: boolean;
  optional_reason?: string;
  estimated_range?: string;
  pricing_note?: string;
  cost_price_ht?: number;
  margin_ht?: number;
  /** Si true, le prix a été modifié manuellement par l'utilisateur → enregistrer dans la mémoire de prix du garage */
  price_manually_edited?: boolean;
};

export async function saveQuoteItemsAction(quoteId: string, items: QuoteItemPayload[]): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  if (!garageId) return { error: "Garage non identifié." };
  const { data: q } = await supabase.from("quotes").select("id, vehicle_id").eq("id", quoteId).eq("garage_id", garageId).single();
  if (!q) return { error: "Devis non trouvé." };

  const usePriceMemory = await isPriceMemoryEnabled(garageId);
  let vehicleMake: string | null = null;
  let vehicleModel: string | null = null;
  if (usePriceMemory && (q as { vehicle_id?: string | null }).vehicle_id) {
    const vid = (q as { vehicle_id: string }).vehicle_id;
    const { data: v } = await supabase.from("vehicles").select("brand, model").eq("id", vid).eq("garage_id", garageId).maybeSingle();
    if (v) {
      vehicleMake = (v as { brand?: string | null }).brand ?? null;
      vehicleModel = (v as { model?: string | null }).model ?? null;
    }
  }

  for (const it of items) {
    if (!it.price_manually_edited || it.type == null || !["part", "labor", "forfait"].includes(it.type)) continue;
    const desc = (it.description ?? "").trim();
    const key = normalizeKey(desc);
    if (!key) continue;
    const price = Number(it.unit_price);
    if (Number.isNaN(price) || price < 0) continue;
    await upsertPriceMemory(
      garageId,
      it.type as PriceBookItemType,
      key,
      desc || key,
      price,
      vehicleMake,
      vehicleModel
    );
  }

  await supabase.from("quote_items").delete().eq("quote_id", quoteId);

  if (items.length === 0) return {};

  const rows = items.map((it) => {
    const description = it.description ?? "";
    const row: {
      quote_id: string;
      garage_id: string;
      description: string;
      label?: string;
      quantity: number;
      unit_price: number;
      total: number;
      type?: string;
      optional?: boolean;
      optional_reason?: string | null;
      estimated_range?: string | null;
      pricing_note?: string | null;
      cost_price_ht?: number | null;
      margin_ht?: number | null;
    } = {
      quote_id: quoteId,
      garage_id: garageId,
      description,
      quantity: it.quantity ?? 0,
      unit_price: it.unit_price ?? 0,
      total: it.total ?? 0,
      optional: it.optional ?? false,
      optional_reason: it.optional_reason || null,
      estimated_range: it.estimated_range || null,
      pricing_note: it.pricing_note || null,
      cost_price_ht: it.cost_price_ht || null,
      margin_ht: it.margin_ht || null,
    };
    if (it.type && ["labor", "part", "forfait"].includes(it.type)) row.type = it.type;
    row.label = description;
    return row;
  });

  const { error } = await supabase.from("quote_items").insert(rows);
  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("label") && !msg.includes("null")) {
      const rowsWithoutLabel = rows.map(({ label: _l, ...rest }) => rest);
      const retry = await supabase.from("quote_items").insert(rowsWithoutLabel);
      if (!retry.error) return {};
    }
    if (msg.includes("type") || msg.includes("column")) {
      const rowsWithoutType = rows.map(({ quote_id: qid, garage_id: gid, description: d, quantity: q, unit_price: u, total: t }) => ({
        quote_id: qid,
        garage_id: gid,
        description: d,
        quantity: q,
        unit_price: u,
        total: t,
      }));
      const retry = await supabase.from("quote_items").insert(rowsWithoutType);
      if (!retry.error) return {};
    }
    return { error: error.message };
  }
  return {};
}

export type ExportQuoteRow = {
  reference: string;
  statut: string;
  date_creation: string;
  valide_jusquau: string;
  client_nom: string;
  client_email: string;
  vehicule: string;
  total_ht: number;
  tva: number;
  total_ttc: number;
  nb_lignes: number;
  notes_client: string;
  notes_internes: string;
};

export type ExportQuoteItemRow = {
  quote_reference: string;
  item_type: string;
  description: string;
  qty: number;
  unit_price_ht: number;
  total_ht: number;
};

/**
 * Formate une date au format DD/MM/YYYY
 */
function formatDateFR(date: string | null | undefined): string {
  if (!date) return "";
  try {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "";
  }
}

/**
 * Exporte les devis au format CSV
 * @param filters Filtres à appliquer (optionnel)
 * @param includeItems Si true, retourne les lignes d'items au lieu des devis
 * @returns Données formatées pour CSV ou erreur
 */
export async function exportQuotesCsv(
  filters?: QuoteListFilters,
  includeItems?: boolean
): Promise<{ data: ExportQuoteRow[] | ExportQuoteItemRow[]; error?: string }> {
  const garageId = await getCurrentGarageId();
  const supabase = await createClient();

  // Récupérer les devis avec joins clients/vehicles
  let query = supabase
    .from("quotes")
    .select(
      "id, reference, status, created_at, valid_until, total_ht, total_ttc, notes, notes_client, clients(id, name, email), vehicles(registration, brand, model)"
    )
    .order("created_at", { ascending: false })
    .limit(500); // Limite à 500 devis

  if (garageId) query = query.eq("garage_id", garageId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.facture_number === "not_null") query = query.not("facture_number", "is", null);
  if (filters?.archived === true) query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);

  const result = await query;
  let quotes: any[] = [];

  if (result.error && (result.error.message?.includes("archived_at") || result.error.message?.includes("does not exist") || result.error.message?.includes("facture_number"))) {
    // Fallback sans archived_at / facture_number si colonne absente
    let fallbackQuery = supabase
      .from("quotes")
      .select("id, reference, status, created_at, valid_until, total_ht, total_ttc, notes, notes_client, clients(id, name, email), vehicles(registration, brand, model)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (garageId) fallbackQuery = fallbackQuery.eq("garage_id", garageId);
    if (filters?.status) fallbackQuery = fallbackQuery.eq("status", filters.status);
    if (filters?.facture_number === "not_null") fallbackQuery = fallbackQuery.not("facture_number", "is", null);
    const fallback = await fallbackQuery;
    if (fallback.error) return { data: [], error: fallback.error.message };
    quotes = fallback.data ?? [];
  } else if (!result.error && result.data) {
    quotes = result.data;
  } else if (result.error) {
    return { data: [], error: result.error.message };
  }

  // Appliquer les filtres supplémentaires côté serveur
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const firstDayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (filters?.period === "this_month") {
    quotes = quotes.filter((q) => new Date(q.created_at) >= firstDayMonth);
  } else if (filters?.period === "last_30") {
    quotes = quotes.filter((q) => new Date(q.created_at) >= thirtyDaysAgo);
  }

  if (filters?.expired) {
    quotes = quotes.filter((q) => q.status === "sent" && q.valid_until && q.valid_until < today);
  }
  if (filters?.toRelance) {
    quotes = quotes.filter(
      (q) =>
        q.status === "sent" &&
        q.valid_until &&
        q.valid_until >= today &&
        q.valid_until <= sevenDaysLater.toISOString().slice(0, 10)
    );
  }

  if (filters?.q?.trim()) {
    const term = filters.q.trim().toLowerCase();
    quotes = quotes.filter((q) => {
      const ref = (q.reference ?? "").toLowerCase();
      const clientName =
        q.clients && typeof q.clients === "object" && "name" in q.clients
          ? String((q.clients as { name: string | null }).name ?? "").toLowerCase()
          : "";
      const v = q.vehicles;
      const reg =
        v && typeof v === "object" && "registration" in v ? String((v as { registration: string | null }).registration ?? "").toLowerCase() : "";
      const brand = v && typeof v === "object" && "brand" in v ? String((v as { brand: string | null }).brand ?? "").toLowerCase() : "";
      const model = v && typeof v === "object" && "model" in v ? String((v as { model: string | null }).model ?? "").toLowerCase() : "";
      return ref.includes(term) || clientName.includes(term) || reg.includes(term) || brand.includes(term) || model.includes(term);
    });
  }

  // Si on veut exporter avec les lignes d'items
  if (includeItems) {
    const itemRows: ExportQuoteItemRow[] = [];
    for (const quote of quotes) {
      const { data: items } = await supabase.from("quote_items").select("description, quantity, unit_price, total, type").eq("quote_id", quote.id).order("created_at");
      const quoteItems = items ?? [];

      if (quoteItems.length === 0) {
        // Même sans items, créer une ligne pour le devis
        itemRows.push({
          quote_reference: quote.reference ?? `#${quote.id.slice(0, 8)}`,
          item_type: "",
          description: "",
          qty: 0,
          unit_price_ht: 0,
          total_ht: 0,
        });
      } else {
        for (const item of quoteItems) {
          itemRows.push({
            quote_reference: quote.reference ?? `#${quote.id.slice(0, 8)}`,
            item_type: (item.type as string) ?? "",
            description: (item.description as string) ?? "",
            qty: Number(item.quantity) ?? 0,
            unit_price_ht: Number(item.unit_price) ?? 0,
            total_ht: Number(item.total) ?? 0,
          });
        }
      }
    }
    return { data: itemRows };
  }

  // Format standard : 1 ligne par devis
  // Récupérer le nombre de lignes pour chaque devis
  const rows: ExportQuoteRow[] = [];
  for (const quote of quotes) {
    const { count: itemsCount } = await supabase
      .from("quote_items")
      .select("id", { count: "exact", head: true })
      .eq("quote_id", quote.id);

    const clientName =
      quote.clients && typeof quote.clients === "object" && "name" in quote.clients
        ? String((quote.clients as { name: string | null }).name ?? "")
        : "";
    const clientEmail =
      quote.clients && typeof quote.clients === "object" && "email" in quote.clients
        ? String((quote.clients as { email: string | null }).email ?? "")
        : "";

    const v = quote.vehicles;
    const vehicleParts: string[] = [];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if ("registration" in v && v.registration) vehicleParts.push(String(v.registration));
      if ("brand" in v && v.brand) vehicleParts.push(String(v.brand));
      if ("model" in v && v.model) vehicleParts.push(String(v.model));
    }
    const vehicleLabel = vehicleParts.join(" ") || "";

    const totalHt = Number(quote.total_ht) ?? 0;
    const totalTtc = Number(quote.total_ttc) ?? 0;
    const tva = totalTtc - totalHt;

    rows.push({
      reference: quote.reference ?? `#${quote.id.slice(0, 8)}`,
      statut: quote.status ?? "",
      date_creation: formatDateFR(quote.created_at),
      valide_jusquau: formatDateFR(quote.valid_until),
      client_nom: clientName,
      client_email: clientEmail,
      vehicule: vehicleLabel,
      total_ht: totalHt,
      tva: Math.round(tva * 100) / 100,
      total_ttc: totalTtc,
      nb_lignes: itemsCount ?? 0,
      notes_client: (quote.notes_client as string) ?? "",
      notes_internes: (quote.notes as string) ?? "",
    });
  }

  return { data: rows };
}
