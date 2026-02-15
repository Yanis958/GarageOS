-- Ajouter les colonnes notes et notes_client à la table quotes (si elles n'existent pas).
-- À exécuter dans Supabase : SQL Editor > Coller > Run.
-- Puis : Project Settings > API > Reload schema cache.

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS notes_client text;
