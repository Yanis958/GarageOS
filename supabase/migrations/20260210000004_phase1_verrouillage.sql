-- Phase 1 Verrouillage produit : FK, quota IA, observabilité ai_events

-- 1. FK manquantes (garage_id -> garages)
ALTER TABLE public.quick_tasks
  DROP CONSTRAINT IF EXISTS fk_quick_tasks_garage_id,
  ADD CONSTRAINT fk_quick_tasks_garage_id
  FOREIGN KEY (garage_id) REFERENCES public.garages(id) ON DELETE CASCADE;

ALTER TABLE public.planning_assignments
  DROP CONSTRAINT IF EXISTS fk_planning_assignments_garage_id,
  ADD CONSTRAINT fk_planning_assignments_garage_id
  FOREIGN KEY (garage_id) REFERENCES public.garages(id) ON DELETE CASCADE;

-- 2. Quota mensuel IA par garage (NULL = pas de limite)
ALTER TABLE public.garage_settings
  ADD COLUMN IF NOT EXISTS ai_monthly_quota int;

COMMENT ON COLUMN public.garage_settings.ai_monthly_quota IS 'Quota de requêtes IA par mois pour ce garage ; NULL = illimité';

-- 3. Table ai_events (observabilité : chaque appel IA)
CREATE TABLE IF NOT EXISTS public.ai_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  latency_ms int NOT NULL DEFAULT 0,
  tokens_in int,
  tokens_out int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_events_garage_created ON public.ai_events(garage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_events_feature_created ON public.ai_events(feature, created_at DESC);
COMMENT ON TABLE public.ai_events IS 'Observabilité des appels IA (feature, statut, latence, tokens)';

ALTER TABLE public.ai_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_events_insert_authenticated" ON public.ai_events;
CREATE POLICY "ai_events_insert_authenticated" ON public.ai_events
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "ai_events_select_admin" ON public.ai_events;
CREATE POLICY "ai_events_select_admin" ON public.ai_events
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

-- Lecture ai_usage par les membres du garage (pour checkAiQuota côté app)
DROP POLICY IF EXISTS "ai_usage_select_own_garage" ON public.ai_usage;
CREATE POLICY "ai_usage_select_own_garage" ON public.ai_usage
  FOR SELECT TO authenticated
  USING (garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid()));
