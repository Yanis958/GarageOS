-- ============================================================================
-- SCRIPT DE RÉINITIALISATION COMPLÈTE : Repartir à zéro
-- ============================================================================
-- Ce script :
-- 1. Supprime TOUTES les anciennes données (clients, véhicules, devis)
-- 2. Supprime TOUS les anciens garages
-- 3. Crée un nouveau garage propre
-- 4. Lie TOUS les utilisateurs au nouveau garage
-- 5. Configure les politiques RLS
-- 
-- ⚠️ ATTENTION : Ce script supprime TOUTES les données existantes !
-- 
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard > SQL Editor
-- 2. Copiez-collez ce script
-- 3. Cliquez sur "Run" (ou Ctrl+Enter)
-- 4. Retournez dans GarageOS et rafraîchissez
-- ============================================================================

-- ============================================================================
-- PARTIE 1 : SUPPRIMER TOUTES LES ANCIENNES DONNÉES
-- ============================================================================

-- Supprimer les lignes de devis
DELETE FROM quote_items;

-- Supprimer les devis
DELETE FROM quotes;

-- Supprimer les véhicules
DELETE FROM vehicles;

-- Supprimer les clients
DELETE FROM clients;

-- Supprimer les liens garage_members
DELETE FROM garage_members;

-- Supprimer tous les garages
DELETE FROM garages;

-- ============================================================================
-- PARTIE 2 : CONFIGURER LES POLITIQUES RLS
-- ============================================================================

-- GARAGES
DROP POLICY IF EXISTS "Allow authenticated select garages" ON public.garages;
CREATE POLICY "Allow authenticated select garages"
ON public.garages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update garages" ON public.garages;
CREATE POLICY "Allow authenticated update garages"
ON public.garages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated insert garages" ON public.garages;
CREATE POLICY "Allow authenticated insert garages"
ON public.garages FOR INSERT TO authenticated WITH CHECK (true);

-- GARAGE_MEMBERS
DROP POLICY IF EXISTS "Allow authenticated select garage_members" ON public.garage_members;
CREATE POLICY "Allow authenticated select garage_members"
ON public.garage_members FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert garage_members" ON public.garage_members;
CREATE POLICY "Allow authenticated insert garage_members"
ON public.garage_members FOR INSERT TO authenticated WITH CHECK (true);

-- CLIENTS
DROP POLICY IF EXISTS "Allow authenticated insert clients" ON public.clients;
CREATE POLICY "Allow authenticated insert clients"
ON public.clients FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select clients" ON public.clients;
CREATE POLICY "Allow authenticated select clients"
ON public.clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update clients" ON public.clients;
CREATE POLICY "Allow authenticated update clients"
ON public.clients FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete clients" ON public.clients;
CREATE POLICY "Allow authenticated delete clients"
ON public.clients FOR DELETE TO authenticated USING (true);

-- VÉHICULES
DROP POLICY IF EXISTS "Allow authenticated insert vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated insert vehicles"
ON public.vehicles FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated select vehicles"
ON public.vehicles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated update vehicles"
ON public.vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated delete vehicles"
ON public.vehicles FOR DELETE TO authenticated USING (true);

-- DEVIS
DROP POLICY IF EXISTS "Allow authenticated insert quotes" ON public.quotes;
CREATE POLICY "Allow authenticated insert quotes"
ON public.quotes FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select quotes" ON public.quotes;
CREATE POLICY "Allow authenticated select quotes"
ON public.quotes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update quotes" ON public.quotes;
CREATE POLICY "Allow authenticated update quotes"
ON public.quotes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete quotes" ON public.quotes;
CREATE POLICY "Allow authenticated delete quotes"
ON public.quotes FOR DELETE TO authenticated USING (true);

-- LIGNES DE DEVIS
DROP POLICY IF EXISTS "Allow authenticated insert quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated insert quote_items"
ON public.quote_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated select quote_items"
ON public.quote_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated update quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated update quote_items"
ON public.quote_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated delete quote_items"
ON public.quote_items FOR DELETE TO authenticated USING (true);

-- ============================================================================
-- PARTIE 3 : CRÉER UN NOUVEAU GARAGE PROPRE
-- ============================================================================

DO $$
DECLARE
  v_garage_id uuid;
  v_user_record RECORD;
  v_linked_count integer := 0;
BEGIN
  -- Créer un nouveau garage propre
  INSERT INTO garages (id, name, address, created_at, updated_at)
  VALUES (
    gen_random_uuid(),
    'Mon Garage',
    '',
    NOW(),
    NOW()
  )
  RETURNING id INTO v_garage_id;
  
  RAISE NOTICE '✅ Nouveau garage créé avec l''ID: %', v_garage_id;

  -- Lier TOUS les utilisateurs au nouveau garage
  FOR v_user_record IN SELECT id FROM auth.users ORDER BY created_at LOOP
    -- Vérifier si le lien existe déjà avant d'insérer
    IF NOT EXISTS (
      SELECT 1 FROM garage_members 
      WHERE garage_id = v_garage_id AND user_id = v_user_record.id
    ) THEN
      INSERT INTO garage_members (garage_id, user_id, role, created_at)
      VALUES (v_garage_id, v_user_record.id, 'owner', NOW());
      v_linked_count := v_linked_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE '✅ % utilisateur(s) lié(s) au nouveau garage', v_linked_count;
END $$;

-- ============================================================================
-- VÉRIFICATION FINALE
-- ============================================================================

SELECT 
  '✅ RÉINITIALISATION TERMINÉE' AS type,
  '' AS valeur
UNION ALL
SELECT 
  'Garage ID',
  (SELECT id::text FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Nom du garage',
  COALESCE((SELECT name FROM garages ORDER BY created_at LIMIT 1), 'Mon Garage')
UNION ALL
SELECT 
  'Utilisateurs liés',
  COUNT(*)::text
FROM garage_members
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Clients',
  '0'
UNION ALL
SELECT 
  'Véhicules',
  '0'
UNION ALL
SELECT 
  'Devis',
  '0';
