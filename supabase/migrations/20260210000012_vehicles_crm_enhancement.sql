-- ============================================================================
-- Migration : Gestion Véhicules CRM (multi-tenant)
-- ============================================================================
-- Objectif : Vérifier et compléter le schéma vehicles pour un usage CRM simple
-- - Vérifier existence table vehicles
-- - Ajouter colonnes manquantes (mileage)
-- - Vérifier vehicle_id dans quotes (déjà présent)
-- - Ajouter contraintes qualité (unicité immatriculation par garage)
-- - Ajouter trigger normalisation plaque (uppercase)
-- - Ajouter trigger pour vérifier garage_id cohérence avec client (PAS de CHECK)
-- - Index pour performance
-- ============================================================================

-- 0. NETTOYAGE : Supprimer toute contrainte CHECK problématique existante
-- ============================================================================

-- Supprimer toute contrainte CHECK sur vehicles qui pourrait utiliser une sous-requête
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT conname, conrelid::regclass
    FROM pg_constraint
    WHERE conrelid = 'public.vehicles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%SELECT%'
  ) LOOP
    EXECUTE 'ALTER TABLE ' || r.conrelid || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname);
  END LOOP;
END $$;

-- Supprimer spécifiquement la contrainte problématique si elle existe
ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_garage_matches_client_garage;

-- 1. VÉRIFICATION ET CRÉATION TABLE VEHICLES SI ABSENTE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'vehicles'
  ) THEN
    -- Créer la table vehicles si elle n'existe pas
    CREATE TABLE public.vehicles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
      client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
      registration text NOT NULL, -- Immatriculation (normalisée uppercase)
      brand text, -- Marque (ex: Renault, Peugeot)
      model text, -- Modèle (ex: Clio, 308)
      vin text, -- Numéro VIN (Vehicle Identification Number)
      year int, -- Année de fabrication
      mileage int, -- Kilométrage
      created_at timestamptz NOT NULL DEFAULT now(),
      archived_at timestamptz,
      archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
    );

    COMMENT ON TABLE public.vehicles IS 'Véhicules des clients (CRM simple, multi-tenant)';
    COMMENT ON COLUMN public.vehicles.registration IS 'Immatriculation normalisée (uppercase, format AB-123-CD)';
    COMMENT ON COLUMN public.vehicles.brand IS 'Marque du véhicule';
    COMMENT ON COLUMN public.vehicles.model IS 'Modèle du véhicule';
    COMMENT ON COLUMN public.vehicles.mileage IS 'Kilométrage actuel du véhicule';
  END IF;
END $$;

-- 2. AJOUTER COLONNES MANQUANTES (si table existe déjà)
-- ============================================================================

-- Ajouter mileage si absent
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS mileage int;

-- Ajouter archived_by si absent
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS archived_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Commentaires pour les colonnes existantes
COMMENT ON COLUMN public.vehicles.mileage IS 'Kilométrage actuel du véhicule';

-- 3. VÉRIFIER VEHICLE_ID DANS QUOTES
-- ============================================================================

-- Vérifier si vehicle_id existe dans quotes, sinon l'ajouter
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
    AND table_name = 'quotes' 
    AND column_name = 'vehicle_id'
  ) THEN
    ALTER TABLE public.quotes ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;
    COMMENT ON COLUMN public.quotes.vehicle_id IS 'Référence au véhicule (optionnel pour devis sans véhicule spécifique)';
  END IF;
END $$;

-- 4. CONTRAINTES QUALITÉ
-- ============================================================================

-- Contrainte : Unicité immatriculation par garage (si registration non null)
-- Note: On utilise un index unique partiel car registration peut être null théoriquement
-- mais dans la pratique, on veut qu'il soit unique par garage s'il est renseigné
DO $$
BEGIN
  -- Supprimer l'index s'il existe déjà
  DROP INDEX IF EXISTS idx_vehicles_garage_registration_unique;
  
  -- Créer un index unique partiel (uniquement si registration IS NOT NULL)
  CREATE UNIQUE INDEX idx_vehicles_garage_registration_unique 
  ON public.vehicles(garage_id, UPPER(TRIM(registration))) 
  WHERE registration IS NOT NULL AND TRIM(registration) != '';
END $$;

COMMENT ON INDEX idx_vehicles_garage_registration_unique IS 'Unicité immatriculation par garage (normalisée uppercase)';

-- 5. TRIGGER POUR VÉRIFIER COHÉRENCE GARAGE_ID AVEC CLIENT
-- ============================================================================

-- Fonction pour vérifier que vehicles.garage_id correspond à clients.garage_id
-- (PostgreSQL n'autorise pas les sous-requêtes dans CHECK, donc on utilise un trigger)
CREATE OR REPLACE FUNCTION public.check_vehicle_client_garage_match()
RETURNS TRIGGER AS $$
DECLARE
  client_garage_id uuid;
BEGIN
  -- Récupérer le garage_id du client lié
  SELECT garage_id INTO client_garage_id
  FROM public.clients
  WHERE id = NEW.client_id;

  -- Si le client n'existe pas, erreur
  IF client_garage_id IS NULL THEN
    RAISE EXCEPTION 'Le client avec id % n''existe pas', NEW.client_id;
  END IF;

  -- Si les garage_id ne correspondent pas, erreur
  IF NEW.garage_id != client_garage_id THEN
    RAISE EXCEPTION 'Le garage_id du véhicule (%) doit correspondre au garage_id du client (%)', 
      NEW.garage_id, client_garage_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_vehicle_client_garage_match() IS 
  'Vérifie que le garage_id du véhicule correspond au garage_id du client lié (remplace CHECK avec sous-requête)';

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_check_vehicle_client_garage_match ON public.vehicles;

-- Créer le trigger
CREATE TRIGGER trigger_check_vehicle_client_garage_match
  BEFORE INSERT OR UPDATE OF garage_id, client_id ON public.vehicles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_vehicle_client_garage_match();

-- 6. TRIGGER POUR NORMALISER LA PLAQUE (UPPERCASE)
-- ============================================================================

-- Fonction pour normaliser la plaque en uppercase
CREATE OR REPLACE FUNCTION public.normalize_vehicle_registration()
RETURNS TRIGGER AS $$
BEGIN
  -- Normaliser registration en uppercase et trim
  IF NEW.registration IS NOT NULL THEN
    NEW.registration = UPPER(TRIM(NEW.registration));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.normalize_vehicle_registration() IS 
  'Normalise automatiquement la plaque d''immatriculation en uppercase';

-- Supprimer le trigger s'il existe déjà
DROP TRIGGER IF EXISTS trigger_normalize_vehicle_registration ON public.vehicles;

-- Créer le trigger
CREATE TRIGGER trigger_normalize_vehicle_registration
  BEFORE INSERT OR UPDATE OF registration ON public.vehicles
  FOR EACH ROW
  WHEN (NEW.registration IS NOT NULL)
  EXECUTE FUNCTION public.normalize_vehicle_registration();

-- 7. INDEX POUR PERFORMANCE
-- ============================================================================

-- Index sur garage_id (déjà présent probablement via RLS, mais on s'assure)
CREATE INDEX IF NOT EXISTS idx_vehicles_garage_id ON public.vehicles(garage_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_client_id ON public.vehicles(client_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_registration ON public.vehicles(registration);
CREATE INDEX IF NOT EXISTS idx_vehicles_archived_at ON public.vehicles(archived_at);

-- Index composite pour recherche rapide par garage et client
CREATE INDEX IF NOT EXISTS idx_vehicles_garage_client ON public.vehicles(garage_id, client_id);

-- Index sur quotes.vehicle_id pour jointures rapides
CREATE INDEX IF NOT EXISTS idx_quotes_vehicle_id ON public.quotes(vehicle_id) WHERE vehicle_id IS NOT NULL;

-- Index composite quotes pour recherche par garage et vehicle
CREATE INDEX IF NOT EXISTS idx_quotes_garage_vehicle ON public.quotes(garage_id, vehicle_id) WHERE vehicle_id IS NOT NULL;

-- 8. RLS (Vérifier que les policies existent déjà)
-- ============================================================================

-- Les policies RLS sont déjà créées dans 20260210000001_rls_garage.sql
-- On vérifie juste qu'elles existent, sinon on les crée

DO $$
BEGIN
  -- Vérifier si RLS est activé
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'vehicles' 
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Vérifier si les policies existent, sinon les créer
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'vehicles' 
    AND policyname = 'vehicles_garage_select'
  ) THEN
    CREATE POLICY "vehicles_garage_select" ON public.vehicles FOR SELECT TO authenticated
      USING (garage_id IN (SELECT current_user_garage_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'vehicles' 
    AND policyname = 'vehicles_garage_insert'
  ) THEN
    CREATE POLICY "vehicles_garage_insert" ON public.vehicles FOR INSERT TO authenticated
      WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'vehicles' 
    AND policyname = 'vehicles_garage_update'
  ) THEN
    CREATE POLICY "vehicles_garage_update" ON public.vehicles FOR UPDATE TO authenticated
      USING (garage_id IN (SELECT current_user_garage_ids()))
      WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'vehicles' 
    AND policyname = 'vehicles_garage_delete'
  ) THEN
    CREATE POLICY "vehicles_garage_delete" ON public.vehicles FOR DELETE TO authenticated
      USING (garage_id IN (SELECT current_user_garage_ids()));
  END IF;
END $$;

-- 9. VÉRIFICATION TABLE INVOICES (FACTURES)
-- ============================================================================

-- Note: Dans ce projet, les factures sont des quotes avec facture_number rempli
-- Il n'y a pas de table invoices séparée
-- vehicle_id est déjà dans quotes, donc pas besoin d'ajouter dans une table invoices

-- 10. FONCTION HELPER OPTIONNELLE (si besoin)
-- ============================================================================

-- Fonction pour obtenir les véhicules d'un client (déjà gérée côté app, mais utile en SQL)
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
  SELECT 
    v.id,
    v.registration,
    v.brand,
    v.model,
    v.year,
    v.mileage
  FROM public.vehicles v
  WHERE v.client_id = p_client_id
    AND v.archived_at IS NULL
    AND v.garage_id IN (SELECT current_user_garage_ids())
  ORDER BY v.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_client_vehicles(uuid) IS 
  'Retourne les véhicules actifs d''un client (filtrés par RLS)';

-- ============================================================================
-- FIN DE LA MIGRATION
-- ============================================================================
-- Résumé :
-- ✅ Table vehicles vérifiée/créée avec colonnes : id, garage_id, client_id, 
--    registration, brand, model, vin, year, mileage, created_at, archived_at, archived_by
-- ✅ Colonne mileage ajoutée si absente
-- ✅ vehicle_id vérifié dans quotes (déjà présent, nullable)
-- ✅ Index unique sur (garage_id, registration) pour unicité par garage
-- ✅ Trigger pour normaliser registration en uppercase
-- ✅ Trigger pour vérifier garage_id cohérent avec client.garage_id (remplace CHECK avec sous-requête)
-- ✅ Index de performance sur garage_id, client_id, registration, archived_at
-- ✅ RLS policies vérifiées/créées
-- ✅ Fonction helper get_client_vehicles() créée
-- ============================================================================
