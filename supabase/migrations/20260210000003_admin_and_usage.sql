-- Mode admin interne (super-admin) : liste des admins, audit, usage IA, feature flags
-- Pour donner les droits admin à un utilisateur : INSERT INTO public.admin_users (user_id) VALUES ('uuid-de-l-utilisateur');

-- 1. Comptes admin (seuls ces user_id peuvent accéder à /dashboard/admin)
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);
COMMENT ON TABLE public.admin_users IS 'Utilisateurs autorisés à accéder au mode admin (super-admin)';

-- 2. Logs d''audit pour les modifications admin
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON public.admin_audit_log(entity_type, entity_id);
COMMENT ON TABLE public.admin_audit_log IS 'Traçabilité des actions effectuées par les admins';

-- 3. Usage IA par garage et par mois (nb requêtes)
CREATE TABLE IF NOT EXISTS public.ai_usage (
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  period text NOT NULL,
  request_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (garage_id, period)
);
COMMENT ON TABLE public.ai_usage IS 'Nombre de requêtes IA par garage et par mois (period = YYYY-MM)';

-- 4. Feature flags par garage (clés libres : ai_quote_explain, ai_copilot, etc.)
CREATE TABLE IF NOT EXISTS public.garage_feature_flags (
  garage_id uuid NOT NULL REFERENCES public.garages(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (garage_id, feature_key)
);
COMMENT ON TABLE public.garage_feature_flags IS 'Activation/désactivation de fonctionnalités par garage';

-- ---------- RLS

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_users_select_own" ON public.admin_users;
CREATE POLICY "admin_users_select_own" ON public.admin_users
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_audit_log_insert_authenticated" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_insert_authenticated" ON public.admin_audit_log
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "admin_audit_log_select_admin" ON public.admin_audit_log;
CREATE POLICY "admin_audit_log_select_admin" ON public.admin_audit_log
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ai_usage_select_admin" ON public.ai_usage;
CREATE POLICY "ai_usage_select_admin" ON public.ai_usage
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));
DROP POLICY IF EXISTS "ai_usage_insert_authenticated" ON public.ai_usage;
CREATE POLICY "ai_usage_insert_authenticated" ON public.ai_usage
  FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ai_usage_update_authenticated" ON public.ai_usage;
CREATE POLICY "ai_usage_update_authenticated" ON public.ai_usage
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE public.garage_feature_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "garage_feature_flags_select_garage_member" ON public.garage_feature_flags;
CREATE POLICY "garage_feature_flags_select_garage_member" ON public.garage_feature_flags
  FOR SELECT TO authenticated
  USING (
    garage_id IN (SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid())
    OR auth.uid() IN (SELECT user_id FROM public.admin_users)
  );
DROP POLICY IF EXISTS "garage_feature_flags_admin_write" ON public.garage_feature_flags;
CREATE POLICY "garage_feature_flags_admin_write" ON public.garage_feature_flags
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));

-- Admins peuvent lire tous les garages et tous les garage_settings
DROP POLICY IF EXISTS "garages_select_admin" ON public.garages;
CREATE POLICY "garages_select_admin" ON public.garages
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));

DROP POLICY IF EXISTS "garage_settings_select_admin" ON public.garage_settings;
CREATE POLICY "garage_settings_select_admin" ON public.garage_settings
  FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users));
DROP POLICY IF EXISTS "garage_settings_update_admin" ON public.garage_settings;
CREATE POLICY "garage_settings_update_admin" ON public.garage_settings
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));
