"use server";

import { createClient } from "@/lib/supabase/server";
import type { PdfDevisGarage } from "@/lib/pdf-devis/types";
import type { GarageCustomSettings } from "@/lib/garage/types";

/**
 * Récupère toutes les données du garage nécessaires pour la génération PDF.
 * Retourne un objet PdfDevisGarage avec tous les champs, avec des fallbacks propres.
 */
export async function getGarageDataForPdf(garageId: string): Promise<PdfDevisGarage | null> {
  const supabase = await createClient();

  // Récupérer le garage
  const { data: garage, error: garageError } = await supabase
    .from("garages")
    .select("id, name, address")
    .eq("id", garageId)
    .maybeSingle();

  if (garageError || !garage) {
    console.error("Erreur lors de la récupération du garage:", garageError);
    return null;
  }

  // Récupérer les settings du garage
  const { data: settings, error: settingsError } = await supabase
    .from("garage_settings")
    .select("*")
    .eq("garage_id", garageId)
    .maybeSingle();

  if (settingsError) {
    console.error("Erreur lors de la récupération des settings:", settingsError);
  }

  // Construire l'adresse complète
  const addressParts = [
    settings?.address_line1 || garage.address,
    settings?.address_line2,
    settings?.postal_code && settings?.city
      ? `${settings.postal_code} ${settings.city}`
      : settings?.postal_code || settings?.city,
    settings?.country,
  ].filter(Boolean);
  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : null;

  // Construire l'objet avec fallbacks
  return {
    name: garage.name ?? null,
    address: fullAddress || garage.address || (settings?.address ?? null),
    address_line1: settings?.address_line1 ?? (garage.address ?? null),
    address_line2: settings?.address_line2 ?? null,
    postal_code: settings?.postal_code ?? null,
    city: settings?.city ?? null,
    country: settings?.country ?? "France",
    phone: settings?.phone ?? null,
    email: settings?.email ?? null,
    siret: settings?.siret ?? null,
    logo_url: settings?.logo_url ?? null,
    vat_intracom: settings?.vat_intracom ?? null,
    payment_terms: settings?.payment_terms ?? null,
    payment_delay_days: settings?.payment_delay_days ?? null,
    legal_mentions: settings?.legal_mentions ?? null,
    late_payment_penalties: settings?.late_payment_penalties ?? null,
    iban: settings?.iban ?? null,
    bic: settings?.bic ?? null,
    // Thème PDF : theme_primary / theme_accent, avec fallback sur primary_color (saisi dans Paramètres)
    theme_primary: (() => {
      const val = settings?.theme_primary ?? (settings as { primary_color?: string } | null)?.primary_color;
      if (!val || typeof val !== "string" || val.trim() === "") return null;
      const cleaned = val.trim();
      const hex = cleaned.startsWith("#") ? cleaned.slice(1) : cleaned;
      if (hex.length === 6 && /^[0-9A-Fa-f]{6}$/.test(hex)) {
        return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
      }
      return null;
    })(),
    theme_accent: (() => {
      const val = settings?.theme_accent;
      if (!val || typeof val !== "string" || val.trim() === "") return null;
      const cleaned = val.trim();
      const hex = cleaned.startsWith("#") ? cleaned.slice(1) : cleaned;
      if (hex.length === 6 && /^[0-9A-Fa-f]{6}$/.test(hex)) {
        return cleaned.startsWith("#") ? cleaned : `#${cleaned}`;
      }
      return null;
    })(),
    theme_mode: settings?.theme_mode ?? null,
    theme_surface: settings?.theme_surface ?? null,
    theme_text: settings?.theme_text ?? null,
    pdf_style: settings?.pdf_style ?? "modern",
    // Footer text depuis custom_settings.appearance.footer_text ou pdf_footer
    pdfFooter: (() => {
      const customSettings = (settings?.custom_settings as GarageCustomSettings) ?? {};
      const appearance = customSettings.appearance ?? {};
      return appearance.footer_text ?? settings?.pdf_footer ?? null;
    })(),
  };
}
