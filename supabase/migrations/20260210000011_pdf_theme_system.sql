-- Système de thème pour les PDFs : ajout des champs de thème et infos légales dans garage_settings

-- Extension de garage_settings pour le thème PDF
ALTER TABLE public.garage_settings
  -- Adresse complète (déjà partiellement dans garages.address, mais on veut plus de détails)
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'France',
  -- Infos bancaires
  ADD COLUMN IF NOT EXISTS iban text,
  ADD COLUMN IF NOT EXISTS bic text,
  -- Thème PDF
  ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark', 'system')),
  ADD COLUMN IF NOT EXISTS theme_primary text DEFAULT '#7C3AED',
  ADD COLUMN IF NOT EXISTS theme_accent text DEFAULT '#22C55E',
  ADD COLUMN IF NOT EXISTS theme_surface text,
  ADD COLUMN IF NOT EXISTS theme_text text,
  -- Style PDF (préparation futur)
  ADD COLUMN IF NOT EXISTS pdf_style text DEFAULT 'modern' CHECK (pdf_style IN ('modern', 'classic', 'minimal'));

COMMENT ON COLUMN public.garage_settings.address_line1 IS 'Adresse ligne 1 du garage';
COMMENT ON COLUMN public.garage_settings.address_line2 IS 'Complément d''adresse (ligne 2)';
COMMENT ON COLUMN public.garage_settings.postal_code IS 'Code postal';
COMMENT ON COLUMN public.garage_settings.city IS 'Ville';
COMMENT ON COLUMN public.garage_settings.country IS 'Pays (défaut: France)';
COMMENT ON COLUMN public.garage_settings.iban IS 'IBAN pour les paiements';
COMMENT ON COLUMN public.garage_settings.bic IS 'BIC pour les paiements';
COMMENT ON COLUMN public.garage_settings.theme_mode IS 'Mode de thème: light, dark, ou system';
COMMENT ON COLUMN public.garage_settings.theme_primary IS 'Couleur primaire du thème (hex, ex: #7C3AED)';
COMMENT ON COLUMN public.garage_settings.theme_accent IS 'Couleur accent du thème (hex, ex: #22C55E)';
COMMENT ON COLUMN public.garage_settings.theme_surface IS 'Couleur de surface pour dark mode (optionnel)';
COMMENT ON COLUMN public.garage_settings.theme_text IS 'Couleur de texte pour dark mode (optionnel)';
COMMENT ON COLUMN public.garage_settings.pdf_style IS 'Style de PDF: modern, classic, ou minimal';
