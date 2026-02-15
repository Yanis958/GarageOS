-- Migration : table quick_tasks (tâches à faire liées à un client ou véhicule)
-- À appliquer dans Supabase (SQL Editor) si besoin.

CREATE TABLE IF NOT EXISTS public.quick_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'vehicle')),
  entity_id uuid NOT NULL,
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quick_tasks_garage_entity ON public.quick_tasks(garage_id, entity_type, entity_id);

COMMENT ON TABLE public.quick_tasks IS 'Tâches à faire liées à une fiche client ou véhicule (note rapide)';

ALTER TABLE public.quick_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated select quick_tasks" ON public.quick_tasks;
DROP POLICY IF EXISTS "Allow authenticated insert quick_tasks" ON public.quick_tasks;
DROP POLICY IF EXISTS "Allow authenticated update quick_tasks" ON public.quick_tasks;
DROP POLICY IF EXISTS "Allow authenticated delete quick_tasks" ON public.quick_tasks;

CREATE POLICY "Allow authenticated select quick_tasks" ON public.quick_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert quick_tasks" ON public.quick_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update quick_tasks" ON public.quick_tasks FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete quick_tasks" ON public.quick_tasks FOR DELETE TO authenticated USING (true);
