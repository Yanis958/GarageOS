-- À exécuter dans Supabase : SQL Editor > New query > Coller > Run
-- Corrige l'erreur "Could not find the 'description' column of 'quote_items'"
-- en créant la table ou en ajoutant les colonnes manquantes.

-- Créer la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  description text DEFAULT '',
  quantity numeric DEFAULT 0,
  unit_price numeric DEFAULT 0,
  total numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Ajouter les colonnes si la table existait avec une autre structure
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS unit_price numeric DEFAULT 0;
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS total numeric DEFAULT 0;

-- Optionnel : type de ligne (Pièce / Main-d'œuvre / Forfait)
ALTER TABLE public.quote_items ADD COLUMN IF NOT EXISTS type text DEFAULT 'part';

-- Index pour les requêtes par quote_id
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);

-- RLS : autoriser les utilisateurs authentifiés (à exécuter si besoin)
-- DROP POLICY IF EXISTS "Allow authenticated insert quote_items" ON public.quote_items;
-- CREATE POLICY "Allow authenticated insert quote_items" ON public.quote_items FOR INSERT TO authenticated WITH CHECK (true);
-- CREATE POLICY "Allow authenticated select quote_items" ON public.quote_items FOR SELECT TO authenticated USING (true);
-- CREATE POLICY "Allow authenticated update quote_items" ON public.quote_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
-- CREATE POLICY "Allow authenticated delete quote_items" ON public.quote_items FOR DELETE TO authenticated USING (true);
