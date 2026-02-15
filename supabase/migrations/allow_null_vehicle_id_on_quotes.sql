-- Permettre de créer un devis sans véhicule ("Aucun (à préciser plus tard)").
-- À exécuter dans Supabase : SQL Editor > Coller > Run.

ALTER TABLE public.quotes
ALTER COLUMN vehicle_id DROP NOT NULL;
