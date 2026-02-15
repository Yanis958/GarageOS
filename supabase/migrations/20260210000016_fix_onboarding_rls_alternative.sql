-- ============================================================================
-- Migration Alternative : Fonction SECURITY DEFINER pour l'onboarding
-- ============================================================================
-- Si la migration précédente ne fonctionne pas, cette approche utilise une fonction
-- SECURITY DEFINER pour contourner RLS lors de la création du premier garage
-- ============================================================================

-- Fonction pour créer le premier garage (contourne RLS)
CREATE OR REPLACE FUNCTION public.create_first_garage(
  p_name text,
  p_address text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_garage_id uuid;
  v_user_id uuid;
BEGIN
  -- Vérifier que l'utilisateur est authentifié
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Vérifier que l'utilisateur n'a pas déjà de garage
  IF EXISTS (SELECT 1 FROM public.garage_members WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'User already has a garage';
  END IF;

  -- Créer le garage
  INSERT INTO public.garages (name, address)
  VALUES (p_name, p_address)
  RETURNING id INTO v_garage_id;

  -- Créer le membre (owner)
  INSERT INTO public.garage_members (garage_id, user_id, role)
  VALUES (v_garage_id, v_user_id, 'owner');

  -- Créer les settings par défaut
  INSERT INTO public.garage_settings (garage_id)
  VALUES (v_garage_id)
  ON CONFLICT (garage_id) DO NOTHING;

  -- Créer les feature flags par défaut
  INSERT INTO public.garage_feature_flags (garage_id, feature_key, enabled)
  SELECT v_garage_id, key, true
  FROM (VALUES 
    ('ai_quote_explain'),
    ('ai_copilot'),
    ('ai_insights'),
    ('ai_quote_audit'),
    ('ai_generate_lines'),
    ('ai_planning'),
    ('ai_quick_note'),
    ('ai_client_message')
  ) AS features(key)
  ON CONFLICT (garage_id, feature_key) DO NOTHING;

  RETURN v_garage_id;
END;
$$;

COMMENT ON FUNCTION public.create_first_garage IS 
  'Crée le premier garage pour l''utilisateur authentifié (contourne RLS pour l''onboarding)';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_first_garage TO authenticated;

-- ============================================================================
-- ✅ FIN
-- ============================================================================
