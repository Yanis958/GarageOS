-- Rappels, facture, tâches garage, date prévue (RDV)
-- 1. garage_settings : option rappels devis expirés
ALTER TABLE public.garage_settings
  ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN public.garage_settings.reminders_enabled IS 'Si true, les rappels (devis expirés / à relancer) sont actifs (notifications in-app et future option email)';

-- 2. quotes : numéro de facture (rempli à la 1ère génération facture) + date prévue (RDV)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS facture_number text,
  ADD COLUMN IF NOT EXISTS planned_at date;
COMMENT ON COLUMN public.quotes.facture_number IS 'Numéro de facture (ex. F-2026-001) renseigné à la première génération PDF facture';
COMMENT ON COLUMN public.quotes.planned_at IS 'Date prévue pour l''intervention / RDV client';

-- 3. Tâches garage (à faire) : liste globale par garage, avec échéance optionnelle
CREATE TABLE IF NOT EXISTS public.garage_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  title text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_garage_due ON public.garage_tasks(garage_id, due_date);
CREATE INDEX IF NOT EXISTS idx_garage_tasks_garage_done ON public.garage_tasks(garage_id, done);
COMMENT ON TABLE public.garage_tasks IS 'Tâches à faire du garage (rappels, RDV, suivi)';

ALTER TABLE public.garage_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "garage_tasks_select_own" ON public.garage_tasks;
DROP POLICY IF EXISTS "garage_tasks_insert_own" ON public.garage_tasks;
DROP POLICY IF EXISTS "garage_tasks_update_own" ON public.garage_tasks;
DROP POLICY IF EXISTS "garage_tasks_delete_own" ON public.garage_tasks;
CREATE POLICY "garage_tasks_select_own" ON public.garage_tasks FOR SELECT TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));
CREATE POLICY "garage_tasks_insert_own" ON public.garage_tasks FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));
CREATE POLICY "garage_tasks_update_own" ON public.garage_tasks FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));
CREATE POLICY "garage_tasks_delete_own" ON public.garage_tasks FOR DELETE TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));
