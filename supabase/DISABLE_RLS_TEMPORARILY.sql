-- ============================================================================
-- SOLUTION URGENTE : DÉSACTIVER RLS TEMPORAIREMENT
-- ============================================================================
-- Ce script désactive RLS sur toutes les tables pour permettre l'accès immédiat
-- ⚠️ À utiliser uniquement en développement, pas en production !
-- ============================================================================

-- Désactiver RLS sur toutes les tables
ALTER TABLE public.garages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.garage_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items DISABLE ROW LEVEL SECURITY;

-- Créer un garage et lier les utilisateurs si nécessaire
DO $$
DECLARE
  v_garage_id uuid;
  v_user_record RECORD;
BEGIN
  SELECT id INTO v_garage_id FROM garages ORDER BY created_at LIMIT 1;
  
  IF v_garage_id IS NULL THEN
    INSERT INTO garages (id, name, address, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Mon Garage', '', NOW(), NOW())
    RETURNING id INTO v_garage_id;
  END IF;

  FOR v_user_record IN SELECT id FROM auth.users LOOP
    INSERT INTO garage_members (garage_id, user_id, role, created_at)
    VALUES (v_garage_id, v_user_record.id, 'owner', NOW())
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

SELECT '✅ RLS désactivé et garage configuré' AS status;
