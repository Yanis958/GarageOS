"use server";

import { createClient } from "@/lib/supabase/server";
import type { GarageSettings, GarageWithSettings, GarageCustomSettings } from "@/lib/garage/types";

/** IDs des garages dont l'utilisateur connecté est membre (garage_members). Aucun fallback : pas d'accès cross-garage. */
export async function getCurrentGarageId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: member, error: memberError } = await supabase
    .from("garage_members")
    .select("garage_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (memberError || !member?.garage_id) return null;
  return member.garage_id;
}

export type CurrentGarage = {
  id: string;
  name: string | null;
  slug?: string | null;
  address: string | null;
  trial_end_date: string | null;
  is_active: boolean;
};

export async function getCurrentGarage(): Promise<CurrentGarage | null> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return null;

  const supabase = await createClient();
  const { data: garage } = await supabase
    .from("garages")
    .select("id, name, slug, address, trial_end_date, is_active")
    .eq("id", garageId)
    .maybeSingle();

  if (!garage) return null;
  return {
    id: garage.id,
    name: garage.name ?? null,
    slug: (garage as { slug?: string | null }).slug ?? null,
    address: garage.address ?? null,
    trial_end_date: (garage as { trial_end_date?: string | null }).trial_end_date ?? null,
    is_active: (garage as { is_active?: boolean }).is_active ?? false,
  };
}

/** Paramètres du garage courant (raccourci). Retourne null si pas de garage ou pas de settings. */
export async function getGarageSettings(): Promise<GarageSettings | null> {
  const data = await getCurrentGarageWithSettings();
  return data?.settings ?? null;
}

/** Indique si la feature flag est activée pour le garage courant. Défaut true si pas de ligne. */
export async function hasFeature(featureKey: string): Promise<boolean> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("garage_feature_flags")
    .select("enabled")
    .eq("garage_id", garageId)
    .eq("feature_key", featureKey)
    .maybeSingle();
  return data?.enabled ?? true;
}

/** Récupère le garage courant et ses paramètres (pour le contexte et les pages). */
export async function getCurrentGarageWithSettings(): Promise<GarageWithSettings | null> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return null;

  const supabase = await createClient();
  const { data: garage } = await supabase
    .from("garages")
    .select("id, name, slug, address, trial_end_date, is_active")
    .eq("id", garageId)
    .maybeSingle();

  if (!garage) return null;

  let { data: settings } = await supabase
    .from("garage_settings")
    .select("*")
    .eq("garage_id", garageId)
    .maybeSingle();

  // Si les settings n'existent pas, les créer avec des valeurs par défaut
  if (!settings) {
    const { data: newSettings, error: insertError } = await supabase
      .from("garage_settings")
      .insert({
        garage_id: garageId,
        vat_rate: 20,
        hourly_rate: 60,
        currency: "EUR",
        quote_valid_days: 30,
        include_client_explanation_in_email: true,
        reminders_enabled: true,
      })
      .select()
      .single();
    
    if (!insertError && newSettings) {
      settings = newSettings;
    }
  }

  return {
    garage: {
      id: garage.id,
      name: garage.name ?? null,
      slug: (garage as { slug?: string | null }).slug ?? null,
      address: garage.address ?? null,
      trial_end_date: (garage as { trial_end_date?: string | null }).trial_end_date ?? null,
      is_active: (garage as { is_active?: boolean }).is_active ?? false,
    },
    settings: settings as GarageSettings | null,
  };
}

export type GarageSettingsPayload = {
  logo_url?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  siret?: string | null;
  vat_rate?: number;
  hourly_rate?: number;
  currency?: string;
  quote_valid_days?: number;
  pdf_footer?: string | null;
  email_signature?: string | null;
  primary_color?: string | null;
  email_subject?: string | null;
  include_client_explanation_in_email?: boolean;
  ai_monthly_quota?: number | null;
  reminders_enabled?: boolean;
  // Nouveaux champs pour PDF personnalisé
  vat_intracom?: string | null;
  payment_terms?: string | null;
  payment_delay_days?: number | null;
  legal_mentions?: string | null;
  late_payment_penalties?: string | null;
  invoice_prefix?: string;
  credit_note_prefix?: string;
  // Nouveaux champs pour thème PDF
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  iban?: string | null;
  bic?: string | null;
  theme_mode?: string | null;
  theme_primary?: string | null;
  theme_accent?: string | null;
  theme_surface?: string | null;
  theme_text?: string | null;
  pdf_style?: string | null;
  // Settings personnalisés JSONB
  custom_settings?: GarageCustomSettings;
};

/** Met à jour les paramètres du garage (upsert). Vérifie que l'utilisateur appartient au garage. */
export async function updateGarageSettingsAction(
  garageId: string,
  payload: GarageSettingsPayload
): Promise<{ error?: string }> {
  const currentId = await getCurrentGarageId();
  if (!currentId || currentId !== garageId) return { error: "Non autorisé." };

  const supabase = await createClient();
  const updateData: Record<string, unknown> = {};
  if (payload.logo_url !== undefined) updateData.logo_url = payload.logo_url ?? null;
  if (payload.phone !== undefined) updateData.phone = payload.phone ?? null;
  if (payload.email !== undefined) updateData.email = payload.email ?? null;
  if (payload.address !== undefined) updateData.address = payload.address ?? null;
  if (payload.siret !== undefined) updateData.siret = payload.siret ?? null;
  if (payload.vat_rate !== undefined) updateData.vat_rate = payload.vat_rate;
  if (payload.hourly_rate !== undefined) updateData.hourly_rate = payload.hourly_rate;
  if (payload.currency !== undefined) updateData.currency = payload.currency ?? "EUR";
  if (payload.quote_valid_days !== undefined) updateData.quote_valid_days = payload.quote_valid_days;
  if (payload.pdf_footer !== undefined) updateData.pdf_footer = payload.pdf_footer ?? null;
  if (payload.email_signature !== undefined) updateData.email_signature = payload.email_signature ?? null;
  if (payload.primary_color !== undefined) updateData.primary_color = payload.primary_color ?? null;
  if (payload.email_subject !== undefined) updateData.email_subject = payload.email_subject ?? null;
  if (payload.include_client_explanation_in_email !== undefined) updateData.include_client_explanation_in_email = payload.include_client_explanation_in_email;
  if (payload.ai_monthly_quota !== undefined) updateData.ai_monthly_quota = payload.ai_monthly_quota ?? null;
  if (payload.reminders_enabled !== undefined) updateData.reminders_enabled = payload.reminders_enabled;
  // Nouveaux champs pour PDF personnalisé
  if (payload.vat_intracom !== undefined) updateData.vat_intracom = payload.vat_intracom ?? null;
  if (payload.payment_terms !== undefined) updateData.payment_terms = payload.payment_terms ?? null;
  if (payload.payment_delay_days !== undefined) updateData.payment_delay_days = payload.payment_delay_days ?? null;
  if (payload.legal_mentions !== undefined) updateData.legal_mentions = payload.legal_mentions ?? null;
  if (payload.late_payment_penalties !== undefined) updateData.late_payment_penalties = payload.late_payment_penalties ?? null;
  if (payload.invoice_prefix !== undefined) updateData.invoice_prefix = payload.invoice_prefix ?? "F";
  if (payload.credit_note_prefix !== undefined) updateData.credit_note_prefix = payload.credit_note_prefix ?? "AV";
  // Nouveaux champs pour thème PDF
  if (payload.address_line1 !== undefined) updateData.address_line1 = payload.address_line1 ?? null;
  if (payload.address_line2 !== undefined) updateData.address_line2 = payload.address_line2 ?? null;
  if (payload.postal_code !== undefined) updateData.postal_code = payload.postal_code ?? null;
  if (payload.city !== undefined) updateData.city = payload.city ?? null;
  if (payload.country !== undefined) updateData.country = payload.country ?? "France";
  if (payload.iban !== undefined) updateData.iban = payload.iban ?? null;
  if (payload.bic !== undefined) updateData.bic = payload.bic ?? null;
  if (payload.theme_mode !== undefined) updateData.theme_mode = payload.theme_mode ?? "light";
  if (payload.theme_primary !== undefined) updateData.theme_primary = payload.theme_primary ?? "#7C3AED";
  if (payload.theme_accent !== undefined) updateData.theme_accent = payload.theme_accent ?? "#22C55E";
  if (payload.theme_surface !== undefined) updateData.theme_surface = payload.theme_surface ?? null;
  if (payload.theme_text !== undefined) updateData.theme_text = payload.theme_text ?? null;
  if (payload.pdf_style !== undefined) updateData.pdf_style = payload.pdf_style ?? "modern";
  
  // Gestion de custom_settings (merge avec existing)
  if (payload.custom_settings !== undefined) {
    const { data: existing } = await supabase
      .from("garage_settings")
      .select("custom_settings")
      .eq("garage_id", garageId)
      .maybeSingle();
    
    const existingCustom = (existing?.custom_settings as { appearance?: { footer_text?: string | null; show_logo_on_pdf?: boolean; enable_compact_mode?: boolean } }) ?? {};
    const mergedCustom = {
      ...existingCustom,
      ...payload.custom_settings,
      appearance: {
        ...existingCustom.appearance,
        ...payload.custom_settings.appearance,
      },
    };
    
    updateData.custom_settings = mergedCustom;
  }

  if (Object.keys(updateData).length === 0) return {};

  console.log("updateGarageSettingsAction: Mise à jour pour garageId:", garageId);
  console.log("updateGarageSettingsAction: Données à mettre à jour:", updateData);

  const { data: existing } = await supabase
    .from("garage_settings")
    .select("garage_id")
    .eq("garage_id", garageId)
    .maybeSingle();

  if (existing) {
    console.log("updateGarageSettingsAction: UPDATE des settings existantes");
    const { data: updatedData, error: updateError } = await supabase
      .from("garage_settings")
      .update(updateData)
      .eq("garage_id", garageId)
      .select()
      .single();
    if (updateError) {
      console.error("updateGarageSettingsAction: Erreur UPDATE:", updateError);
      return { error: updateError.message };
    }
    console.log("updateGarageSettingsAction: UPDATE réussi:", updatedData);
    return {};
  } else {
    console.log("updateGarageSettingsAction: INSERT de nouvelles settings");
    const { data: insertedData, error: insertError } = await supabase
      .from("garage_settings")
      .insert({
        garage_id: garageId,
        vat_rate: 20,
        hourly_rate: 60,
        currency: "EUR",
        quote_valid_days: 30,
        include_client_explanation_in_email: true,
        reminders_enabled: true,
        ...updateData,
      })
      .select()
      .single();
    if (insertError) {
      console.error("updateGarageSettingsAction: Erreur INSERT:", insertError);
      return { error: insertError.message };
    }
    console.log("updateGarageSettingsAction: INSERT réussi:", insertedData);
    return {};
  }
}

export async function updateGarageAction(garageId: string, payload: { name?: string | null; address?: string | null }): Promise<{ error?: string }> {
  const currentId = await getCurrentGarageId();
  if (!currentId || currentId !== garageId) return { error: "Non autorisé." };
  const supabase = await createClient();

  const updateData: Record<string, string | null> = {};
  if (payload.name !== undefined) updateData.name = payload.name ?? null;
  if (payload.address !== undefined) updateData.address = payload.address ?? null;
  if (Object.keys(updateData).length === 0) return {};

  const { data, error } = await supabase
    .from("garages")
    .update(updateData)
    .eq("id", garageId)
    .select("id")
    .maybeSingle();

  if (error) return { error: error.message };
  if (!data) {
    return {
      error:
        "La mise à jour n'a pas été enregistrée. Ajoute la politique RLS UPDATE sur la table garages dans Supabase (SQL Editor).",
    };
  }
  return {};
}

const GARAGE_LOGOS_BUCKET = "garage-logos";

/** Upload le logo du garage vers Storage et met à jour garage_settings.logo_url. */
export async function uploadGarageLogoAction(formData: FormData): Promise<{ error?: string; logoUrl?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé." };

  const file = formData.get("file") as File | null;
  if (!file || !file.size) return { error: "Aucun fichier." };

  const supabase = await createClient();
  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const path = `${garageId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(GARAGE_LOGOS_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || "image/png" });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { data: urlData } = supabase.storage.from(GARAGE_LOGOS_BUCKET).getPublicUrl(path);
  const logoUrl = urlData.publicUrl;

  const updateErr = await updateGarageSettingsAction(garageId, { logo_url: logoUrl });
  if (updateErr.error) return { error: updateErr.error };
  return { logoUrl };
}

/** Supprime le logo du garage (met logo_url à null en base). */
export async function removeGarageLogoAction(): Promise<{ error?: string }> {
  const garageId = await getCurrentGarageId();
  if (!garageId) return { error: "Non autorisé." };
  return updateGarageSettingsAction(garageId, { logo_url: null });
}
