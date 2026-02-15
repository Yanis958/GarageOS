-- ============================================================================
-- VERSION TEST - Migration Véhicules CRM (sans contrainte CHECK problématique)
-- ============================================================================
-- Cette version teste uniquement les parties critiques sans erreur CHECK
-- ============================================================================

-- 1. Ajouter colonne mileage si absente
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS mileage int;
COMMENT ON COLUMN public.vehicles.mileage IS 'Kilométrage actuel du véhicule';

-- 2. Vérifier vehicle_id dans quotes (déjà présent normalement)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'quotes' 
    AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Index unique immatriculation (sans contrainte CHECK)
DROP INDEX IF EXISTS idx_vehicles_garage_registration_unique;
CREATE UNIQUE INDEX idx_vehicles_garage_registration_unique 
ON public.vehicles(garage_id, UPPER(TRIM(registration))) 
WHERE registration IS NOT NULL AND TRIM(registration) != '';

-- 4. Trigger pour vérifier cohérence garage_id (REMPLACE la contrainte CHECK)
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

-- 5. Trigger normalisation plaque
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

-- 6. Index de performance
CREATE INDEX IF NOT EXISTS idx_vehicles_garage_id ON public.vehicles(garage_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_client_id ON public.vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON public.vehicles(registration);
CREATE INDEX IF NOT EXISTS idx_quotes_vehicle_id ON public.quotes(vehicle_id) WHERE vehicle_id IS NOT NULL;

-- ✅ FIN - Aucune contrainte CHECK avec sous-requête
