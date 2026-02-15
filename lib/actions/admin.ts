"use server";

import { createClient } from "@/lib/supabase/server";
import type { GarageSettings } from "@/lib/garage/types";
import { ADMIN_FEATURE_KEYS } from "@/lib/admin/constants";

/**
 * Indique si l'utilisateur connecté est administrateur plateforme (propriétaire GarageOS).
 * Seuls les utilisateurs présents dans la table `admin_users` sont considérés comme admin.
 * Le menu "Admin" dans la sidebar n'est affiché que si isAdmin() === true ;
 * les garages clients (utilisateurs non présents dans admin_users) ne voient pas ce menu.
 */
export async function isAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return !!data;
}

export type AdminGarageListItem = {
  id: string;
  name: string | null;
  slug: string | null;
  address: string | null;
};

export async function getGaragesForAdmin(): Promise<AdminGarageListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("garages")
    .select("id, name, slug, address")
    .order("name", { ascending: true, nullsFirst: false });
  if (error) return [];
  return (data ?? []) as AdminGarageListItem[];
}

export type GarageWithSettingsAdmin = {
  garage: AdminGarageListItem;
  settings: GarageSettings | null;
};

export async function getGarageWithSettingsForAdmin(garageId: string): Promise<GarageWithSettingsAdmin | null> {
  const supabase = await createClient();
  const { data: garage } = await supabase
    .from("garages")
    .select("id, name, slug, address")
    .eq("id", garageId)
    .maybeSingle();
  if (!garage) return null;
  const { data: settings } = await supabase
    .from("garage_settings")
    .select("*")
    .eq("garage_id", garageId)
    .maybeSingle();
  return {
    garage: garage as AdminGarageListItem,
    settings: settings as GarageSettings | null,
  };
}

export type GarageSettingsAdminPayload = {
  hourly_rate?: number;
  vat_rate?: number;
  currency?: string;
  quote_valid_days?: number;
  pdf_footer?: string | null;
  email_signature?: string | null;
  email_subject?: string | null;
  include_client_explanation_in_email?: boolean;
  primary_color?: string | null;
};

export async function updateGarageSettingsAdmin(
  garageId: string,
  payload: GarageSettingsAdminPayload
): Promise<{ error?: string }> {
  const ok = await isAdmin();
  if (!ok) return { error: "Non autorisé." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const updateData: Record<string, unknown> = {};
  if (payload.hourly_rate !== undefined) updateData.hourly_rate = payload.hourly_rate;
  if (payload.vat_rate !== undefined) updateData.vat_rate = payload.vat_rate;
  if (payload.currency !== undefined) updateData.currency = payload.currency ?? "EUR";
  if (payload.quote_valid_days !== undefined) updateData.quote_valid_days = payload.quote_valid_days;
  if (payload.pdf_footer !== undefined) updateData.pdf_footer = payload.pdf_footer ?? null;
  if (payload.email_signature !== undefined) updateData.email_signature = payload.email_signature ?? null;
  if (payload.email_subject !== undefined) updateData.email_subject = payload.email_subject ?? null;
  if (payload.include_client_explanation_in_email !== undefined) updateData.include_client_explanation_in_email = payload.include_client_explanation_in_email;
  if (payload.primary_color !== undefined) updateData.primary_color = payload.primary_color ?? null;

  if (Object.keys(updateData).length === 0) return {};

  const { data: existing } = await supabase
    .from("garage_settings")
    .select("garage_id")
    .eq("garage_id", garageId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("garage_settings")
      .update(updateData)
      .eq("garage_id", garageId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("garage_settings").insert({
      garage_id: garageId,
      ...updateData,
    });
    if (error) return { error: error.message };
  }

  await logAdminAction(user.id, "garage_settings.update", "garage_settings", garageId, { payload: updateData });
  return {};
}

export async function logAdminAction(
  adminUserId: string,
  action: string,
  entityType: string | null,
  entityId: string | null,
  details: Record<string, unknown> | null
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("admin_audit_log").insert({
    admin_user_id: adminUserId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details: details ?? undefined,
  });
}

export type AiUsageRow = { garage_id: string; period: string; request_count: number; garage_name?: string | null };

export async function getAiUsageForAdmin(monthsBack = 12): Promise<AiUsageRow[]> {
  const supabase = await createClient();
  const periods: string[] = [];
  const now = new Date();
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const { data: usage } = await supabase
    .from("ai_usage")
    .select("garage_id, period, request_count")
    .in("period", periods)
    .order("period", { ascending: false });
  if (!usage?.length) return [];
  const garageIds = [...new Set(usage.map((r: { garage_id: string }) => r.garage_id))];
  const { data: garages } = await supabase
    .from("garages")
    .select("id, name")
    .in("id", garageIds);
  const nameById = new Map((garages ?? []).map((g: { id: string; name: string | null }) => [g.id, g.name]));
  return (usage as AiUsageRow[]).map((r) => ({ ...r, garage_name: nameById.get(r.garage_id) ?? null }));
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export async function recordAiUsage(garageId: string): Promise<void> {
  const supabase = await createClient();
  const period = currentPeriod();
  const { data: existing } = await supabase
    .from("ai_usage")
    .select("request_count")
    .eq("garage_id", garageId)
    .eq("period", period)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("ai_usage")
      .update({ request_count: (existing.request_count ?? 0) + 1 })
      .eq("garage_id", garageId)
      .eq("period", period);
  } else {
    await supabase.from("ai_usage").insert({
      garage_id: garageId,
      period,
      request_count: 1,
    });
  }
}

export async function getFeatureFlagsForAdmin(garageId: string): Promise<{ feature_key: string; enabled: boolean }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("garage_feature_flags")
    .select("feature_key, enabled")
    .eq("garage_id", garageId);
  const map = new Map((data ?? []).map((r: { feature_key: string; enabled: boolean }) => [r.feature_key, r.enabled]));
  return ADMIN_FEATURE_KEYS.map((key) => ({
    feature_key: key,
    enabled: map.get(key) ?? true,
  }));
}

export async function setFeatureFlagAdmin(
  garageId: string,
  featureKey: string,
  enabled: boolean
): Promise<{ error?: string }> {
  const ok = await isAdmin();
  if (!ok) return { error: "Non autorisé." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Non authentifié." };

  const { error } = await supabase
    .from("garage_feature_flags")
    .upsert({ garage_id: garageId, feature_key: featureKey, enabled }, { onConflict: "garage_id,feature_key" });
  if (error) return { error: error.message };
  await logAdminAction(user.id, "feature_flag.update", "garage_feature_flags", garageId, { feature_key: featureKey, enabled });
  return {};
}

export type AdminAuditEntry = {
  id: string;
  admin_user_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: unknown;
  created_at: string;
};

export async function getAuditLogsForAdmin(limit = 100): Promise<AdminAuditEntry[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_audit_log")
    .select("id, admin_user_id, action, entity_type, entity_id, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AdminAuditEntry[];
}

/** Utilisé par les routes IA : retourne true si la feature est activée pour le garage (défaut true si pas de ligne). */
export async function isFeatureEnabledForGarage(garageId: string, featureKey: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("garage_feature_flags")
    .select("enabled")
    .eq("garage_id", garageId)
    .eq("feature_key", featureKey)
    .maybeSingle();
  return data?.enabled ?? true;
}
