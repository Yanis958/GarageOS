-- RLS platform hardening + role owner|staff only
-- 1) ai_usage: restrict INSERT/UPDATE to current user's garages
-- 2) ai_events: restrict INSERT to current user's garages
-- 3) garage_members: role enum owner | staff only (migrate manager -> staff)
-- 4) garage_feature_flags: allow members to INSERT/UPDATE their own garage (onboarding + self-service)

-- ---------- 1. ai_usage ----------
DROP POLICY IF EXISTS "ai_usage_insert_authenticated" ON public.ai_usage;
DROP POLICY IF EXISTS "ai_usage_update_authenticated" ON public.ai_usage;

CREATE POLICY "ai_usage_insert_own_garage" ON public.ai_usage
  FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));

CREATE POLICY "ai_usage_update_own_garage" ON public.ai_usage
  FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- 2. ai_events ----------
DROP POLICY IF EXISTS "ai_events_insert_authenticated" ON public.ai_events;

CREATE POLICY "ai_events_insert_own_garage" ON public.ai_events
  FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- 3. garage_members role: owner | staff only ----------
UPDATE public.garage_members SET role = 'staff' WHERE role = 'manager';

ALTER TABLE public.garage_members DROP CONSTRAINT IF EXISTS garage_members_role_check;
ALTER TABLE public.garage_members ADD CONSTRAINT garage_members_role_check
  CHECK (role IN ('owner', 'staff'));

COMMENT ON COLUMN public.garage_members.role IS 'owner = propriétaire du garage, staff = employé';

-- ---------- 4. garage_feature_flags: members can insert/update for their garage ----------
DROP POLICY IF EXISTS "garage_feature_flags_admin_write" ON public.garage_feature_flags;
CREATE POLICY "garage_feature_flags_admin_all" ON public.garage_feature_flags
  FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM public.admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM public.admin_users));

CREATE POLICY "garage_feature_flags_member_insert" ON public.garage_feature_flags
  FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));

CREATE POLICY "garage_feature_flags_member_update" ON public.garage_feature_flags
  FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
