-- ============================================================================
-- SCRIPT DE CORRECTION COMPLÈTE : Fixe TOUT
-- ============================================================================
-- Ce script :
-- 1. Vérifie et recrée les politiques RLS si nécessaire
-- 2. S'assure qu'un garage existe
-- 3. Lie TOUS les utilisateurs au garage
-- 4. Force TOUTES les données au même garage
-- 
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard > SQL Editor
-- 2. Copiez-collez ce script
-- 3. Cliquez sur "Run" (ou Ctrl+Enter)
-- 4. Retournez dans GarageOS et rafraîchissez (Ctrl+Shift+R ou Cmd+Shift+R)
-- ============================================================================

-- ============================================================================
-- PARTIE 1 : RECRÉER LES POLITIQUES RLS (au cas où)
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
-- PARTIE 2 : CRÉER/LIER GARAGE ET UTILISATEURS
-- ============================================================================

DO $$
DECLARE
  v_garage_id uuid;
  v_user_record RECORD;
  v_linked_count integer := 0;
BEGIN
  -- Récupérer ou créer le garage
  SELECT id INTO v_garage_id FROM garages ORDER BY created_at LIMIT 1;
  
  IF v_garage_id IS NULL THEN
    INSERT INTO garages (id, name, address, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Mon Garage',
      '123 Rue de la Mécanique, 75000 Paris',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_garage_id;
    RAISE NOTICE '✅ Garage créé: %', v_garage_id;
  ELSE
    RAISE NOTICE '✅ Garage trouvé: %', v_garage_id;
  END IF;

  -- Lier TOUS les utilisateurs au garage
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
  
  RAISE NOTICE '✅ % utilisateur(s) lié(s) au garage', v_linked_count;
END $$;

-- ============================================================================
-- PARTIE 3 : FORCER TOUTES LES DONNÉES AU PREMIER GARAGE
-- ============================================================================

DO $$
DECLARE
  v_garage_id uuid;
  v_updated integer;
BEGIN
  -- Récupérer le garage
  SELECT id INTO v_garage_id FROM garages ORDER BY created_at LIMIT 1;
  
  IF v_garage_id IS NULL THEN
    RAISE EXCEPTION 'Erreur: Aucun garage trouvé';
  END IF;

  -- Forcer tous les clients
  UPDATE clients SET garage_id = v_garage_id WHERE garage_id IS NULL OR garage_id != v_garage_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '✅ % client(s) mis à jour', v_updated;

  -- Forcer tous les véhicules
  UPDATE vehicles SET garage_id = v_garage_id WHERE garage_id IS NULL OR garage_id != v_garage_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '✅ % véhicule(s) mis à jour', v_updated;

  -- Forcer tous les devis
  UPDATE quotes SET garage_id = v_garage_id WHERE garage_id IS NULL OR garage_id != v_garage_id;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '✅ % devis mis à jour', v_updated;
END $$;

-- ============================================================================
-- VÉRIFICATION FINALE
-- ============================================================================

SELECT 
  '📊 RÉSUMÉ FINAL' AS type,
  '' AS valeur
UNION ALL
SELECT 
  'Garage ID',
  (SELECT id::text FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Nom du garage',
  COALESCE((SELECT name FROM garages ORDER BY created_at LIMIT 1), 'N/A')
UNION ALL
SELECT 
  'Utilisateurs liés',
  COUNT(*)::text
FROM garage_members
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Clients',
  COUNT(*)::text
FROM clients
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Véhicules',
  COUNT(*)::text
FROM vehicles
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Devis',
  COUNT(*)::text
FROM quotes
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Lignes de devis',
  COUNT(*)::text
FROM quote_items
WHERE quote_id IN (
  SELECT id FROM quotes 
  WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
);
