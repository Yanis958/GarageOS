-- ============================================================================
-- Migration : Gestion Véhicules CRM (multi-tenant) - VERSION PROPRE
-- ============================================================================
-- IMPORTANT : Cette version utilise UNIQUEMENT des triggers, PAS de contraintes CHECK
-- ============================================================================

-- NETTOYAGE : Supprimer toute contrainte CHECK problématique existante
-- ============================================================================
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_garage_matches_client_garage;

-- 1. AJOUTER COLONNES MANQUANTES
-- ============================================================================
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS mileage int;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.vehicles.mileage IS 'Kilométrage actuel du véhicule';

-- 2. VÉRIFIER VEHICLE_ID DANS QUOTES
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quotes' AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. INDEX UNIQUE IMMATRICULATION
-- ============================================================================
DROP INDEX IF EXISTS idx_vehicles_garage_registration_unique;
CREATE UNIQUE INDEX idx_vehicles_garage_registration_unique 
ON public.vehicles(garage_id, UPPER(TRIM(registration))) 
WHERE registration IS NOT NULL AND TRIM(registration) != '';

-- 4. TRIGGER : Vérifier cohérence garage_id avec client
-- ============================================================================
-- REMPLACE la contrainte CHECK (qui n'autorise pas les sous-requêtes)
CREATE OR REPLACE FUNCTION public.check_vehicle_client_garage_match()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_vehicle_client_garage_match ON public.vehicles;
CREATE TRIGGER trigger_check_vehicle_client_garage_match
  BEFORE INSERT OR UPDATE OF garage_id, client_id ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_vehicle_client_garage_match();

-- 5. TRIGGER : Normaliser plaque en uppercase
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_vehicle_registration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.registration IS NOT NULL THEN
    NEW.registration = UPPER(TRIM(NEW.registration));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_normalize_vehicle_registration ON public.vehicles;
CREATE TRIGGER trigger_normalize_vehicle_registration
  BEFORE INSERT OR UPDATE OF registration ON public.vehicles
  FOR EACH ROW
  WHEN (NEW.registration IS NOT NULL)
  EXECUTE FUNCTION public.normalize_vehicle_registration();

-- 6. INDEX DE PERFORMANCE
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_garage_id ON public.vehicles(garage_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_client_id ON public.vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON public.vehicles(registration);
CREATE INDEX IF NOT EXISTS idx_vehicles_archived_at ON public.vehicles(archived_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_garage_client ON public.vehicles(garage_id, client_id);
CREATE INDEX IF NOT EXISTS idx_quotes_vehicle_id ON public.quotes(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_garage_vehicle ON public.quotes(garage_id, vehicle_id) WHERE vehicle_id IS NOT NULL;

-- 7. RLS POLICIES (vérification et création si absentes)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'vehicles' AND rowsecurity = true
  ) THEN
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'vehicles_garage_select'
  ) THEN
    CREATE POLICY "vehicles_garage_select" ON public.vehicles FOR SELECT TO authenticated
      USING (garage_id IN (SELECT current_user_garage_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'vehicles_garage_insert'
  ) THEN
    CREATE POLICY "vehicles_garage_insert" ON public.vehicles FOR INSERT TO authenticated
      WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'vehicles_garage_update'
  ) THEN
    CREATE POLICY "vehicles_garage_update" ON public.vehicles FOR UPDATE TO authenticated
      USING (garage_id IN (SELECT current_user_garage_ids()))
      WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'vehicles' AND policyname = 'vehicles_garage_delete'
  ) THEN
    CREATE POLICY "vehicles_garage_delete" ON public.vehicles FOR DELETE TO authenticated
      USING (garage_id IN (SELECT current_user_garage_ids()));
  END IF;
END $$;

-- 8. FONCTION HELPER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_client_vehicles(p_client_id uuid)
RETURNS TABLE (
  id uuid,
  registration text,
  brand text,
  model text,
  year int,
  mileage int
) AS $$
BEGIN
  RETURN QUERY
  SELECT v.id, v.registration, v.brand, v.model, v.year, v.mileage
  FROM public.vehicles v
  WHERE v.client_id = p_client_id
    AND v.archived_at IS NULL
    AND v.garage_id IN (SELECT current_user_garage_ids())
  ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ✅ FIN - AUCUNE contrainte CHECK utilisée, uniquement des triggers
