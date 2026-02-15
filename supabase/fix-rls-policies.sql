-- ============================================================
-- Politiques RLS pour permettre la création de clients, véhicules et devis
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query > Coller et Run
--
-- Si les créations "ne s'enregistrent pas" : c'est souvent que RLS est activé
-- sur les tables mais ces politiques n'ont pas été appliquées. Exécutez tout ce script.
-- Vérifiez aussi qu'il existe au moins une ligne dans la table "garages".
-- ============================================================

-- 1) CLIENTS : autoriser les utilisateurs connectés à tout faire sur leurs lignes
-- (Si ta table a une colonne garage_id, les lignes sont séparées par garage.)

-- Supprimer les anciennes politiques INSERT si elles existent (éviter les doublons)
DROP POLICY IF EXISTS "Allow authenticated insert clients" ON public.clients;
DROP POLICY IF EXISTS "Allow insert clients" ON public.clients;

-- Autoriser l'INSERT pour tout utilisateur authentifié
CREATE POLICY "Allow authenticated insert clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (true);

-- Autoriser SELECT / UPDATE / DELETE pour tout utilisateur authentifié
-- (Tu pourras restreindre plus tard par garage_id si besoin.)
DROP POLICY IF EXISTS "Allow authenticated select clients" ON public.clients;
CREATE POLICY "Allow authenticated select clients"
ON public.clients FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated update clients" ON public.clients;
CREATE POLICY "Allow authenticated update clients"
ON public.clients FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete clients" ON public.clients;
CREATE POLICY "Allow authenticated delete clients"
ON public.clients FOR DELETE
TO authenticated
USING (true);


-- 2) VÉHICULES (même logique)
DROP POLICY IF EXISTS "Allow authenticated insert vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated insert vehicles"
ON public.vehicles FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated select vehicles"
ON public.vehicles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated update vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated update vehicles"
ON public.vehicles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete vehicles" ON public.vehicles;
CREATE POLICY "Allow authenticated delete vehicles"
ON public.vehicles FOR DELETE
TO authenticated
USING (true);


-- 3) DEVIS (quotes)
DROP POLICY IF EXISTS "Allow authenticated insert quotes" ON public.quotes;
CREATE POLICY "Allow authenticated insert quotes"
ON public.quotes FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select quotes" ON public.quotes;
CREATE POLICY "Allow authenticated select quotes"
ON public.quotes FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated update quotes" ON public.quotes;
CREATE POLICY "Allow authenticated update quotes"
ON public.quotes FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete quotes" ON public.quotes;
CREATE POLICY "Allow authenticated delete quotes"
ON public.quotes FOR DELETE
TO authenticated
USING (true);


-- 4) LIGNES DE DEVIS (quote_items) : nécessaire pour enregistrer les lignes d'un devis
DROP POLICY IF EXISTS "Allow authenticated insert quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated insert quote_items"
ON public.quote_items FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated select quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated select quote_items"
ON public.quote_items FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated update quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated update quote_items"
ON public.quote_items FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated delete quote_items" ON public.quote_items;
CREATE POLICY "Allow authenticated delete quote_items"
ON public.quote_items FOR DELETE
TO authenticated
USING (true);


-- 5) GARAGES : lecture et mise à jour (paramètres du garage)
-- Si la table n'a pas les colonnes name et address : ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS name text; ALTER TABLE public.garages ADD COLUMN IF NOT EXISTS address text;
DROP POLICY IF EXISTS "Allow authenticated select garages" ON public.garages;
CREATE POLICY "Allow authenticated select garages"
ON public.garages FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Allow authenticated update garages" ON public.garages;
CREATE POLICY "Allow authenticated update garages"
ON public.garages FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
