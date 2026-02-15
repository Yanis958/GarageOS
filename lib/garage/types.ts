export type GarageAppearanceSettings = {
  footer_text?: string | null;
  show_logo_on_pdf?: boolean;
  enable_compact_mode?: boolean;
};

export type GarageCustomSettings = {
  appearance?: GarageAppearanceSettings;
};

/** Paramètres du garage (table garage_settings) */
export type GarageSettings = {
  garage_id: string;
  logo_url: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  siret: string | null;
  vat_rate: number;
  hourly_rate: number;
  currency: string;
  quote_valid_days: number;
  pdf_footer: string | null;
  email_signature: string | null;
  primary_color: string | null;
  email_subject: string | null;
  include_client_explanation_in_email: boolean;
  ai_monthly_quota: number | null;
  reminders_enabled: boolean;
  updated_at: string;
  // Nouveaux champs pour PDF personnalisé
  vat_intracom: string | null;
  payment_terms: string | null;
  payment_delay_days: number | null;
  legal_mentions: string | null;
  late_payment_penalties: string | null;
  invoice_prefix: string;
  credit_note_prefix: string;
  // Nouveaux champs pour thème PDF
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  iban: string | null;
  bic: string | null;
  theme_mode: string | null;
  theme_primary: string | null;
  theme_accent: string | null;
  theme_surface: string | null;
  theme_text: string | null;
  pdf_style: string | null;
  // Settings personnalisés JSONB
  custom_settings?: GarageCustomSettings | null;
};

/** Garage (table garages) avec slug optionnel */
export type Garage = {
  id: string;
  name: string | null;
  slug: string | null;
  address: string | null;
};

/** Garage + settings pour le contexte (settings peut être null si pas encore créée) */
export type GarageWithSettings = {
  garage: Garage;
  settings: GarageSettings | null;
};
