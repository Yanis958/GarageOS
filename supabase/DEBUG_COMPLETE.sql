-- ============================================================================
-- SCRIPT DE DEBUG COMPLET
-- ============================================================================
-- Ce script diagnostique tous les problèmes possibles
-- ============================================================================

-- 1. Vérifier les garages
SELECT '🏢 GARAGES' AS section, id::text AS garage_id, name, created_at::text
FROM garages ORDER BY created_at;

-- 2. Vérifier les utilisateurs
SELECT '👤 UTILISATEURS' AS section, id::text AS user_id, email, created_at::text
FROM auth.users ORDER BY created_at;

-- 3. Vérifier les liens garage_members
SELECT '🔗 GARAGE_MEMBERS' AS section, 
  garage_id::text, 
  user_id::text, 
  role,
  (SELECT email FROM auth.users WHERE id = garage_members.user_id) AS user_email,
  (SELECT name FROM garages WHERE id = garage_members.garage_id) AS garage_name
FROM garage_members ORDER BY created_at;

-- 4. Vérifier les données par garage_id
SELECT '📊 DONNÉES PAR GARAGE' AS section,
  g.id::text AS garage_id,
  g.name AS garage_name,
  (SELECT COUNT(*) FROM clients WHERE garage_id = g.id) AS clients,
  (SELECT COUNT(*) FROM vehicles WHERE garage_id = g.id) AS vehicles,
  (SELECT COUNT(*) FROM quotes WHERE garage_id = g.id) AS quotes
FROM garages g
ORDER BY g.created_at;

-- 5. Vérifier les données SANS garage_id
SELECT '⚠️ DONNÉES SANS GARAGE_ID' AS section,
  'clients' AS table_name,
  COUNT(*)::text AS count
FROM clients WHERE garage_id IS NULL
UNION ALL
SELECT '⚠️ DONNÉES SANS GARAGE_ID', 'vehicles', COUNT(*)::text
FROM vehicles WHERE garage_id IS NULL
UNION ALL
SELECT '⚠️ DONNÉES SANS GARAGE_ID', 'quotes', COUNT(*)::text
FROM quotes WHERE garage_id IS NULL;

-- 6. Vérifier les politiques RLS sur garages
SELECT '🔒 POLITIQUES RLS GARAGES' AS section,
  policyname,
  permissive,
  roles::text,
  cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'garages';

-- 7. Tester si un utilisateur peut lire les garages (simulation)
-- Note: Ceci nécessite d'être exécuté avec les droits d'un utilisateur authentifié
-- Pour tester vraiment, il faudrait utiliser auth.uid() dans une fonction
