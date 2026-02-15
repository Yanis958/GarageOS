-- ============================================================================
-- SCRIPT DE DIAGNOSTIC : Vérifier l'état du garage et des utilisateurs
-- ============================================================================
-- Ce script affiche des informations pour diagnostiquer pourquoi l'application
-- ne voit pas les données ou ne peut pas créer de nouveaux éléments.
-- ============================================================================

-- 1. Liste des garages
SELECT 
  '🏢 GARAGES' AS section,
  id::text AS garage_id,
  name AS nom,
  created_at::text AS date_creation
FROM garages
ORDER BY created_at;

-- 2. Liste des utilisateurs authentifiés
SELECT 
  '👤 UTILISATEURS' AS section,
  id::text AS user_id,
  email,
  created_at::text AS date_creation
FROM auth.users
ORDER BY created_at;

-- 3. Liens garage_members
SELECT 
  '🔗 LIENS GARAGE_MEMBERS' AS section,
  garage_id::text,
  user_id::text,
  role,
  created_at::text AS date_creation
FROM garage_members
ORDER BY created_at;

-- 4. Données par garage
SELECT 
  '📊 DONNÉES PAR GARAGE' AS section,
  g.id::text AS garage_id,
  g.name AS nom_garage,
  (SELECT COUNT(*) FROM clients WHERE garage_id = g.id) AS nb_clients,
  (SELECT COUNT(*) FROM vehicles WHERE garage_id = g.id) AS nb_vehicules,
  (SELECT COUNT(*) FROM quotes WHERE garage_id = g.id) AS nb_devis
FROM garages g
ORDER BY g.created_at;

-- 5. Vérification RLS (doit retourner des résultats si RLS est bien configuré)
SELECT 
  '🔒 VÉRIFICATION RLS' AS section,
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('clients', 'vehicles', 'quotes', 'quote_items', 'garages', 'garage_members')
ORDER BY tablename, policyname;
