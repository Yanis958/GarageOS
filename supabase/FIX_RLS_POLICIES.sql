-- ============================================================================
-- SCRIPT : Corriger les politiques RLS pour permettre l'accès aux garages
-- ============================================================================
-- Ce script s'assure que TOUTES les politiques RLS sont correctement configurées
-- pour que l'application puisse lire et modifier les données.
-- 
-- INSTRUCTIONS:
-- 1. Ouvrez Supabase Dashboard > SQL Editor
-- 2. Copiez-collez ce script
-- 3. Cliquez sur "Run"
-- 4. Retournez dans GarageOS et rafraîchissez
-- ============================================================================

-- ============================================================================
-- GARAGES - Politiques RLS
-- ============================================================================

-- Supprimer les anciennes politiques
DROP POLICY IF EXISTS "Allow authenticated select garages" ON public.garages;
DROP POLICY IF EXISTS "Allow authenticated update garages" ON public.garages;
DROP POLICY IF EXISTS "Allow authenticated insert garages" ON public.garages;

-- Créer les nouvelles politiques
CREATE POLICY "Allow authenticated select garages"
ON public.garages FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated update garages"
ON public.garages FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated insert garages"
ON public.garages FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- ============================================================================
-- GARAGE_MEMBERS - Politiques RLS
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated select garage_members" ON public.garage_members;
DROP POLICY IF EXISTS "Allow authenticated insert garage_members" ON public.garage_members;

CREATE POLICY "Allow authenticated select garage_members"
ON public.garage_members FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated insert garage_members"
ON public.garage_members FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- ============================================================================
-- CLIENTS - Politiques RLS
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated insert clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated select clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated update clients" ON public.clients;
DROP POLICY IF EXISTS "Allow authenticated delete clients" ON public.clients;

CREATE POLICY "Allow authenticated insert clients"
ON public.clients FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated select clients"
ON public.clients FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated update clients"
ON public.clients FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete clients"
ON public.clients FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- VÉHICULES - Politiques RLS
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated select vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated update vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Allow authenticated delete vehicles" ON public.vehicles;

CREATE POLICY "Allow authenticated insert vehicles"
ON public.vehicles FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated select vehicles"
ON public.vehicles FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated update vehicles"
ON public.vehicles FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete vehicles"
ON public.vehicles FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- DEVIS (QUOTES) - Politiques RLS
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated insert quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated select quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Allow authenticated delete quotes" ON public.quotes;

CREATE POLICY "Allow authenticated insert quotes"
ON public.quotes FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated select quotes"
ON public.quotes FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated update quotes"
ON public.quotes FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete quotes"
ON public.quotes FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- LIGNES DE DEVIS (QUOTE_ITEMS) - Politiques RLS
-- ============================================================================

DROP POLICY IF EXISTS "Allow authenticated insert quote_items" ON public.quote_items;
DROP POLICY IF EXISTS "Allow authenticated select quote_items" ON public.quote_items;
DROP POLICY IF EXISTS "Allow authenticated update quote_items" ON public.quote_items;
DROP POLICY IF EXISTS "Allow authenticated delete quote_items" ON public.quote_items;

CREATE POLICY "Allow authenticated insert quote_items"
ON public.quote_items FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Allow authenticated select quote_items"
ON public.quote_items FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Allow authenticated update quote_items"
ON public.quote_items FOR UPDATE 
TO authenticated 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow authenticated delete quote_items"
ON public.quote_items FOR DELETE 
TO authenticated 
USING (true);

-- ============================================================================
-- VÉRIFICATION
-- ============================================================================

SELECT 
  '✅ POLITIQUES RLS CONFIGURÉES' AS type,
  '' AS valeur
UNION ALL
SELECT 
  'Garages',
  COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'garages'
UNION ALL
SELECT 
  'Garage_members',
  COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'garage_members'
UNION ALL
SELECT 
  'Clients',
  COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'clients'
UNION ALL
SELECT 
  'Véhicules',
  COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'vehicles'
UNION ALL
SELECT 
  'Devis',
  COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quotes'
UNION ALL
SELECT 
  'Lignes de devis',
  COUNT(*)::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'quote_items';
