-- Ajouter colonne JSONB custom_settings si absente
ALTER TABLE public.garage_settings 
  ADD COLUMN IF NOT EXISTS custom_settings jsonb DEFAULT '{}'::jsonb;

-- Index GIN pour requêtes JSONB performantes
CREATE INDEX IF NOT EXISTS idx_garage_settings_custom_settings 
  ON public.garage_settings USING gin(custom_settings);

-- RLS déjà en place (garage_settings_select_own, garage_settings_update_own)
-- Pas besoin de modifier les policies existantes

COMMENT ON COLUMN public.garage_settings.custom_settings IS 
  'Settings personnalisés par garage (appearance, UI preferences) au format JSONB';
