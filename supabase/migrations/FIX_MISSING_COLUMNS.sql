-- Script de correction : Ajouter toutes les colonnes manquantes dans garage_settings
-- À exécuter dans Supabase SQL Editor si les colonnes theme_* ou custom_settings sont manquantes

-- 1. Colonnes de thème PDF (depuis migration 20260210000011_pdf_theme_system.sql)
ALTER TABLE public.garage_settings
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'France',
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS bic text,
  ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark', 'system')),
  ADD COLUMN IF NOT EXISTS theme_primary text DEFAULT '#7C3AED',
  ADD COLUMN IF NOT EXISTS theme_accent text DEFAULT '#22C55E',
  ADD COLUMN IF NOT EXISTS theme_surface text,
  ADD COLUMN IF NOT EXISTS theme_text text,
  ADD COLUMN IF NOT EXISTS pdf_style text DEFAULT 'modern' CHECK (pdf_style IN ('modern', 'classic', 'minimal'));

-- 2. Colonne custom_settings JSONB (depuis migration 20260212000000_appearance_custom_settings.sql)
ALTER TABLE public.garage_settings 
  ADD COLUMN IF NOT EXISTS custom_settings jsonb DEFAULT '{}'::jsonb;

-- 3. Index GIN pour custom_settings
CREATE INDEX IF NOT EXISTS idx_garage_settings_custom_settings 
  ON public.garage_settings USING gin(custom_settings);

-- 4. Commentaires
COMMENT ON COLUMN public.garage_settings.theme_primary IS 'Couleur primaire du thème (hex, ex: #7C3AED)';
COMMENT ON COLUMN public.garage_settings.theme_accent IS 'Couleur accent du thème (hex, ex: #22C55E)';
COMMENT ON COLUMN public.garage_settings.custom_settings IS 'Settings personnalisés par garage (appearance, UI preferences) au format JSONB';
