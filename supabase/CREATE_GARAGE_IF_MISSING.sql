-- ============================================================================
-- SCRIPT SIMPLE : Créer un garage si aucun n'existe
-- ============================================================================
-- Ce script vérifie s'il y a un garage, et en crée un si nécessaire.
-- Il lie aussi tous les utilisateurs au garage.
-- 
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard > SQL Editor
-- 2. Copiez-collez ce script
-- 3. Cliquez sur "Run"
-- 4. Retournez dans GarageOS et rafraîchissez
-- ============================================================================

DO $$
DECLARE
  v_garage_id uuid;
  v_user_record RECORD;
  v_linked_count integer := 0;
BEGIN
  -- Vérifier si un garage existe
  SELECT id INTO v_garage_id FROM garages ORDER BY created_at LIMIT 1;
  
  IF v_garage_id IS NULL THEN
    -- Créer un nouveau garage
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
  ELSE
    RAISE NOTICE '✅ Garage existant trouvé avec l''ID: %', v_garage_id;
  END IF;

  -- S'assurer que TOUS les utilisateurs sont liés au garage
  FOR v_user_record IN SELECT id FROM auth.users ORDER BY created_at LOOP
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

-- Vérification
SELECT 
  '📊 ÉTAT' AS type,
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
WHERE garage_id = (SELECT id FROM garages ORDER BY created_at LIMIT 1);
