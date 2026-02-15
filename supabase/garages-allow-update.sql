-- À exécuter dans Supabase : SQL Editor > New query > Coller > Run
-- Autorise la mise à jour du garage (nom, adresse) depuis l'app.

DROP POLICY IF EXISTS "Allow authenticated update garages" ON public.garages;
CREATE POLICY "Allow authenticated update garages"
ON public.garages FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
