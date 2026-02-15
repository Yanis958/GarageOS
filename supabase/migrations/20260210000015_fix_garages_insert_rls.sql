-- ============================================================================
-- Migration : Autoriser INSERT sur garages pour onboarding (premier garage)
-- ============================================================================
-- Problème : Pas de politique INSERT sur garages → impossible de créer le premier garage
-- Solution : Modifier les politiques existantes pour permettre l'onboarding
-- ============================================================================

-- 1. Politique INSERT pour garages : autoriser si l'utilisateur n'a pas encore de garage
DROP POLICY IF EXISTS "garages_insert_onboarding" ON public.garages;

CREATE POLICY "garages_insert_onboarding" ON public.garages
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur n'est pas déjà membre d'un garage (onboarding)
    NOT EXISTS (
      SELECT 1 FROM public.garage_members 
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "garages_insert_onboarding" ON public.garages IS 
  'Autorise la création d''un garage lors de l''onboarding (si l''utilisateur n''a pas encore de garage)';

-- 2. Modifier la politique garage_members_insert_own_garage pour permettre l'onboarding
-- La politique existante vérifie garage_id IN (SELECT current_user_garage_ids())
-- mais au moment de l'onboarding, l'utilisateur n'a pas encore de garage
-- On ajoute une politique supplémentaire qui permet l'insertion lors de l'onboarding
DROP POLICY IF EXISTS "garage_members_insert_onboarding" ON public.garage_members;

CREATE POLICY "garage_members_insert_onboarding" ON public.garage_members
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur s'insère lui-même comme owner lors de l'onboarding
    user_id = auth.uid()
    AND role = 'owner'
    -- L'utilisateur n'a pas encore de garage (onboarding)
    -- Au moment de l'insertion, cette ligne n'existe pas encore, donc NOT EXISTS sera vrai
    AND NOT EXISTS (
      SELECT 1 FROM public.garage_members
      WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "garage_members_insert_onboarding" ON public.garage_members IS 
  'Autorise l''insertion de garage_members lors de l''onboarding (utilisateur devient owner de son premier garage)';

-- 3. Politique INSERT pour garage_settings : autoriser lors de l'onboarding
-- Note: garage_members est inséré AVANT garage_settings dans createFirstGarageAction
-- donc l'utilisateur sera déjà membre au moment de l'insertion de garage_settings
-- La politique existante garage_settings_insert_own devrait fonctionner,
-- mais on ajoute une politique de secours pour l'onboarding
DROP POLICY IF EXISTS "garage_settings_insert_onboarding" ON public.garage_settings;

CREATE POLICY "garage_settings_insert_onboarding" ON public.garage_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur est membre du garage (dans la même transaction, garage_members est inséré avant)
    garage_id IN (
      SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "garage_settings_insert_onboarding" ON public.garage_settings IS 
  'Autorise l''insertion de garage_settings lors de l''onboarding (utilisateur doit être membre du garage)';

-- 4. Politique INSERT pour garage_feature_flags : autoriser lors de l'onboarding
DROP POLICY IF EXISTS "garage_feature_flags_insert_onboarding" ON public.garage_feature_flags;

CREATE POLICY "garage_feature_flags_insert_onboarding" ON public.garage_feature_flags
  FOR INSERT TO authenticated
  WITH CHECK (
    -- L'utilisateur est membre du garage
    garage_id IN (
      SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()
    )
  );

COMMENT ON POLICY "garage_feature_flags_insert_onboarding" ON public.garage_feature_flags IS 
  'Autorise l''insertion de garage_feature_flags lors de l''onboarding';

-- ============================================================================
-- ✅ FIN
-- ============================================================================
