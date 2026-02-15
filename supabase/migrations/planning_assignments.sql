-- Migration : table planning_assignments (créneaux planning par garage)
-- À appliquer dans Supabase (SQL Editor) si besoin.

CREATE TABLE IF NOT EXISTS public.planning_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  assignment_date date NOT NULL,
  slot_label text NOT NULL CHECK (slot_label IN ('matin', 'apres_midi')),
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('proposed', 'confirmed')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_planning_assignments_garage_date ON public.planning_assignments(garage_id, assignment_date);

COMMENT ON TABLE public.planning_assignments IS 'Assignation devis acceptés à des créneaux (matin / après-midi) pour le planning';
COMMENT ON COLUMN public.planning_assignments.slot_label IS 'matin = 8h-12h, apres_midi = 14h-18h';
COMMENT ON COLUMN public.planning_assignments.status IS 'proposed = suggestion IA, confirmed = validé par l''utilisateur';

-- RLS : accès authentifié (scope garage à gérer côté app via garage_id)
ALTER TABLE public.planning_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated select planning_assignments" ON public.planning_assignments;
DROP POLICY IF EXISTS "Allow authenticated insert planning_assignments" ON public.planning_assignments;
DROP POLICY IF EXISTS "Allow authenticated update planning_assignments" ON public.planning_assignments;
DROP POLICY IF EXISTS "Allow authenticated delete planning_assignments" ON public.planning_assignments;

CREATE POLICY "Allow authenticated select planning_assignments" ON public.planning_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert planning_assignments" ON public.planning_assignments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update planning_assignments" ON public.planning_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated delete planning_assignments" ON public.planning_assignments FOR DELETE TO authenticated USING (true);
