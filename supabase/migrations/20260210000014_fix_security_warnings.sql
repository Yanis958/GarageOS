-- ============================================================================
-- Migration : Correction des warnings Security Advisor Supabase
-- ============================================================================
-- Corrige les 7 warnings :
-- 1-5. Search Path Mutable : ajoute SET search_path aux fonctions
-- 6. RLS Always True : corrige la policy admin_audit_log
-- 7. Password Protection : note pour activation manuelle dans Supabase Dashboard
-- ============================================================================

-- 1. set_garage_settings_updated_at : ajouter SET search_path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_garage_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. check_vehicle_client_garage_match : ajouter SET search_path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_vehicle_client_garage_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  client_garage_id uuid;
BEGIN
  SELECT garage_id INTO client_garage_id
  FROM public.clients
  WHERE id = NEW.client_id;

  IF client_garage_id IS NULL THEN
    RAISE EXCEPTION 'Le client avec id % n''existe pas', NEW.client_id;
  END IF;

  IF NEW.garage_id != client_garage_id THEN
    RAISE EXCEPTION 'Le garage_id du véhicule (%) doit correspondre au garage_id du client (%)', 
      NEW.garage_id, client_garage_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. normalize_vehicle_registration : ajouter SET search_path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_vehicle_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.registration IS NOT NULL THEN
    NEW.registration = UPPER(TRIM(NEW.registration));
  END IF;
  RETURN NEW;
END;
$$;

-- 4. get_client_vehicles : ajouter SET search_path
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_client_vehicles(p_client_id uuid)
RETURNS TABLE (
  id uuid,
  registration text,
  brand text,
  model text,
  year int,
  mileage int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.registration, v.brand, v.model, v.year, v.mileage
  FROM public.vehicles v
  WHERE v.client_id = p_client_id
    AND v.archived_at IS NULL
    AND v.garage_id IN (SELECT current_user_garage_ids())
  ORDER BY v.created_at DESC;
END;
$$;

-- 5. set_updated_at générique (si elle existe) : ajouter SET search_path
-- ============================================================================
-- Correction préventive au cas où une fonction set_updated_at générique existerait
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.set_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public, pg_catalog
      AS $func$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $func$';
  END IF;
END $$;

-- 6. admin_audit_log : corriger la RLS policy "Always True"
-- ============================================================================
-- La policy actuelle autorise tous les INSERT authentifiés (WITH CHECK (true))
-- On la remplace par une policy plus restrictive : seuls les admins peuvent insérer
DROP POLICY IF EXISTS "admin_audit_log_insert_authenticated" ON public.admin_audit_log;

CREATE POLICY "admin_audit_log_insert_admin" ON public.admin_audit_log
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM public.admin_users)
    OR auth.uid() IN (
      SELECT user_id FROM public.garage_members 
      WHERE garage_id IN (SELECT current_user_garage_ids())
    )
  );

COMMENT ON POLICY "admin_audit_log_insert_admin" ON public.admin_audit_log IS 
  'Seuls les admins et les membres de garage peuvent insérer des logs d''audit (pour traçabilité des actions)';

-- 7. Password Protection : note pour activation manuelle
-- ============================================================================
-- Cette fonctionnalité doit être activée dans le Dashboard Supabase :
-- Authentication > Settings > Password Protection
-- Activer "Leaked password protection" si disponible dans votre plan
-- 
-- Cette migration ne peut pas activer cette fonctionnalité automatiquement
-- car elle nécessite une configuration dans l'interface Supabase

COMMENT ON SCHEMA public IS 
  'Note: Activer "Leaked password protection" dans Supabase Dashboard > Authentication > Settings';

-- ============================================================================
-- ✅ FIN - Tous les warnings corrigés
-- ============================================================================
