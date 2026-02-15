-- ============================================================================
-- SCRIPT DE CORRECTION FORCÉE : Forcer toutes les données au premier garage
-- ============================================================================
-- Ce script s'assure que TOUTES les données (clients, véhicules, devis) sont
-- liées au premier garage et que TOUS les utilisateurs y sont liés.
-- 
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard > SQL Editor
-- 2. Copiez-collez ce script
-- 3. Cliquez sur "Run" (ou Ctrl+Enter)
-- 4. Retournez dans GarageOS et rafraîchissez
-- ============================================================================

DO $$
DECLARE
  v_garage_id uuid;
  v_user_record RECORD;
  v_updated_clients integer := 0;
  v_updated_vehicles integer := 0;
  v_updated_quotes integer := 0;
  v_linked_users integer := 0;
BEGIN
  -- ÉTAPE 1 : Récupérer ou créer le garage
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

  -- ÉTAPE 2 : Lier TOUS les utilisateurs au garage
  FOR v_user_record IN SELECT id FROM auth.users ORDER BY created_at LOOP
    -- Vérifier si le lien existe déjà avant d'insérer
    IF NOT EXISTS (
      SELECT 1 FROM garage_members 
      WHERE garage_id = v_garage_id AND user_id = v_user_record.id
    ) THEN
      INSERT INTO garage_members (garage_id, user_id, role, created_at)
      VALUES (v_garage_id, v_user_record.id, 'owner', NOW());
      v_linked_users := v_linked_users + 1;
    END IF;
  END LOOP;
  RAISE NOTICE '✅ % utilisateur(s) lié(s)', v_linked_users;

  -- ÉTAPE 3 : Forcer TOUS les clients au garage
  UPDATE clients 
  SET garage_id = v_garage_id 
  WHERE garage_id IS NULL OR garage_id != v_garage_id;
  GET DIAGNOSTICS v_updated_clients = ROW_COUNT;
  RAISE NOTICE '✅ % client(s) mis à jour', v_updated_clients;

  -- ÉTAPE 4 : Forcer TOUS les véhicules au garage
  UPDATE vehicles 
  SET garage_id = v_garage_id 
  WHERE garage_id IS NULL OR garage_id != v_garage_id;
  GET DIAGNOSTICS v_updated_vehicles = ROW_COUNT;
  RAISE NOTICE '✅ % véhicule(s) mis à jour', v_updated_vehicles;

  -- ÉTAPE 5 : Forcer TOUS les devis au garage
  UPDATE quotes 
  SET garage_id = v_garage_id 
  WHERE garage_id IS NULL OR garage_id != v_garage_id;
  GET DIAGNOSTICS v_updated_quotes = ROW_COUNT;
  RAISE NOTICE '✅ % devis mis à jour', v_updated_quotes;

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
  'Utilisateurs liés',
  COUNT(*)::text
FROM garage_members
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Clients (total)',
  COUNT(*)::text
FROM clients
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Véhicules (total)',
  COUNT(*)::text
FROM vehicles
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1)
UNION ALL
SELECT 
  'Devis (total)',
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

-- Vérifier s'il y a des données sans garage_id
SELECT 
  '⚠️ DONNÉES SANS GARAGE_ID' AS type,
  '' AS valeur
UNION ALL
SELECT 
  'Clients sans garage_id',
  COUNT(*)::text
FROM clients
WHERE garage_id IS NULL
UNION ALL
SELECT 
  'Véhicules sans garage_id',
  COUNT(*)::text
FROM vehicles
WHERE garage_id IS NULL
UNION ALL
SELECT 
  'Devis sans garage_id',
  COUNT(*)::text
FROM quotes
WHERE garage_id IS NULL;
