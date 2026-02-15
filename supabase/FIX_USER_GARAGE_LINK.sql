-- ============================================================================
-- SCRIPT DE CORRECTION : Lier tous les utilisateurs au garage
-- ============================================================================
-- Ce script s'assure que TOUS les utilisateurs authentifiés sont liés au garage
-- et peuvent voir/créer des données dans l'application.
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
  v_linked_count integer := 0;
BEGIN
  -- Récupérer ou créer le garage
  SELECT id INTO v_garage_id FROM garages ORDER BY created_at LIMIT 1;
  
  IF v_garage_id IS NULL THEN
    -- Créer un garage par défaut
    INSERT INTO garages (id, name, address, created_at, updated_at)
    VALUES (
      gen_random_uuid(),
      'Mon Garage',
      '123 Rue de la Mécanique, 75000 Paris',
      NOW(),
      NOW()
    )
    RETURNING id INTO v_garage_id;
    
    RAISE NOTICE '✅ Garage créé avec l''ID: %', v_garage_id;
  ELSE
    RAISE NOTICE '✅ Garage existant trouvé avec l''ID: %', v_garage_id;
  END IF;

  -- Lier TOUS les utilisateurs authentifiés au garage
  FOR v_user_record IN 
    SELECT id FROM auth.users ORDER BY created_at
  LOOP
    -- Vérifier si le lien existe déjà
    IF NOT EXISTS (
      SELECT 1 FROM garage_members 
      WHERE garage_id = v_garage_id 
      AND user_id = v_user_record.id
    ) THEN
      -- Créer le lien
      INSERT INTO garage_members (garage_id, user_id, role, created_at)
      VALUES (v_garage_id, v_user_record.id, 'owner', NOW());
      
      v_linked_count := v_linked_count + 1;
      RAISE NOTICE '✅ Utilisateur % lié au garage', v_user_record.id;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ % utilisateur(s) lié(s) au garage', v_linked_count;
END $$;

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

SELECT 
  '📊 RÉSUMÉ' AS type,
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
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1);
