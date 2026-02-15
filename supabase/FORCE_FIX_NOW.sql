-- ============================================================================
-- SCRIPT URGENT : FORCER LA CONFIGURATION COMPLÈTE
-- ============================================================================
-- Ce script fait TOUT en une seule fois pour résoudre le problème immédiatement
-- ============================================================================

-- 1. DÉSACTIVER TEMPORAIREMENT RLS sur garages pour permettre la lecture
ALTER TABLE public.garages DISABLE ROW LEVEL SECURITY;

-- 2. CRÉER UN GARAGE SI NÉCESSAIRE ET LIER LES UTILISATEURS
DO $$
DECLARE
  v_garage_id uuid;
  v_user_record RECORD;
BEGIN
  -- Récupérer ou créer le garage
  SELECT id INTO v_garage_id FROM garages ORDER BY created_at LIMIT 1;
  
  IF v_garage_id IS NULL THEN
    INSERT INTO garages (id, name, address, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Mon Garage',
      '',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_garage_id;
  END IF;

  -- Lier TOUS les utilisateurs
  FOR v_user_record IN SELECT id FROM auth.users LOOP
    INSERT INTO garage_members (garage_id, user_id, role, created_at)
    VALUES (v_garage_id, v_user_record.id, 'owner', NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- 3. RECRÉER LES POLITIQUES RLS CORRECTEMENT
ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;

-- Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "Allow authenticated select garages" ON public.garages;
DROP POLICY IF EXISTS "Allow authenticated update garages" ON public.garages;
DROP POLICY IF EXISTS "Allow authenticated insert garages" ON public.garages;

-- Créer les nouvelles politiques
CREATE POLICY "Allow authenticated select garages"
ON public.garages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated update garages"
ON public.garages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated insert garages"
ON public.garages FOR INSERT TO authenticated WITH CHECK (true);

-- 4. S'ASSURER QUE LES AUTRES TABLES ONT LES BONNES POLITIQUES
-- Garage_members
DROP POLICY IF EXISTS "Allow authenticated select garage_members" ON public.garage_members;
DROP POLICY IF EXISTS "Allow authenticated insert garage_members" ON public.garage_members;
CREATE POLICY "Allow authenticated select garage_members" ON public.garage_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert garage_members" ON public.garage_members FOR INSERT TO authenticated WITH CHECK (true);

-- Clients
DROP POLICY IF EXISTS "Allow authenticated insert clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated select clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated update clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated delete clients" ON public.clients;
CREATE POLICY "Allow authenticated insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated select clients" ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update clients" ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete clients" ON public.clients FOR DELETE TO authenticated USING (true);

-- Véhicules
DROP POLICY IF EXISTS "Allow authenticated insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated select vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated update vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated delete vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated insert vehicles" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated select vehicles" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update vehicles" ON public.vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (true);

-- Devis
DROP POLICY IF EXISTS "Allow authenticated insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated select quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated delete quotes" ON public.quotes;
CREATE POLICY "Allow authenticated insert quotes" ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated select quotes" ON public.quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update quotes" ON public.quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete quotes" ON public.quotes FOR DELETE TO authenticated USING (true);

-- Lignes de devis
DROP POLICY IF EXISTS "Allow authenticated insert quote_items" ON public.quote_items;
DROP POLICY IF EXISTS "Allow authenticated select quote_items" ON public.quote_items;
DROP POLICY IF EXISTS "Allow authenticated update quote_items" ON public.quote_items;
DROP POLICY IF EXISTS "Allow authenticated delete quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated insert quote_items" ON public.quote_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated select quote_items" ON public.quote_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated update quote_items" ON public.quote_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete quote_items" ON public.quote_items FOR DELETE TO authenticated USING (true);

-- 5. VÉRIFICATION FINALE
SELECT 
  '✅ CONFIGURATION TERMINÉE' AS status,
  (SELECT COUNT(*)::text FROM garages) AS garages_count,
  (SELECT COUNT(*)::text FROM garage_members) AS members_count,
  (SELECT COUNT(*)::text FROM pg_policies WHERE schemaname = 'public' AND tablename = 'garages') AS rls_policies;
