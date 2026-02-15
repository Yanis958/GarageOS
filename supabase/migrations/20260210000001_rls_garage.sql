-- RLS: current_user_garage_ids() + policies so each garage only sees its own data.
-- Depends on: 20260210000000_garage_multi_tenant.sql (garage_settings, garage_members.role, etc.)

CREATE OR REPLACE FUNCTION public.current_user_garage_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT garage_id FROM public.garage_members WHERE user_id = auth.uid();
$$;

COMMENT ON FUNCTION public.current_user_garage_ids() IS 'Garage IDs the current user is a member of (for RLS policies).';

-- ---------- garages ----------
ALTER TABLE public.garages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "garages_select_own" ON public.garages;
DROP POLICY IF EXISTS "garages_update_own" ON public.garages;
CREATE POLICY "garages_select_own" ON public.garages FOR SELECT TO authenticated
  USING (id IN (SELECT current_user_garage_ids()));
CREATE POLICY "garages_update_own" ON public.garages FOR UPDATE TO authenticated
  USING (id IN (SELECT current_user_garage_ids()))
  WITH CHECK (id IN (SELECT current_user_garage_ids()));

-- ---------- garage_members ----------
ALTER TABLE public.garage_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "garage_members_select_own" ON public.garage_members;
DROP POLICY IF EXISTS "garage_members_insert_own_garage" ON public.garage_members;
DROP POLICY IF EXISTS "garage_members_update_own" ON public.garage_members;
DROP POLICY IF EXISTS "garage_members_delete_own" ON public.garage_members;
CREATE POLICY "garage_members_select_own" ON public.garage_members FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "garage_members_insert_own_garage" ON public.garage_members FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "garage_members_update_own" ON public.garage_members FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "garage_members_delete_own" ON public.garage_members FOR DELETE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- garage_settings ----------
ALTER TABLE public.garage_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "garage_settings_select_own" ON public.garage_settings;
DROP POLICY IF EXISTS "garage_settings_insert_own" ON public.garage_settings;
DROP POLICY IF EXISTS "garage_settings_update_own" ON public.garage_settings;
CREATE POLICY "garage_settings_select_own" ON public.garage_settings FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "garage_settings_insert_own" ON public.garage_settings FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "garage_settings_update_own" ON public.garage_settings FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- clients ----------
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_garage_select" ON public.clients;
DROP POLICY IF EXISTS "clients_garage_insert" ON public.clients;
DROP POLICY IF EXISTS "clients_garage_update" ON public.clients;
DROP POLICY IF EXISTS "clients_garage_delete" ON public.clients;
CREATE POLICY "clients_garage_select" ON public.clients FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "clients_garage_insert" ON public.clients FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "clients_garage_update" ON public.clients FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "clients_garage_delete" ON public.clients FOR DELETE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- vehicles ----------
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vehicles_garage_select" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_garage_insert" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_garage_update" ON public.vehicles;
DROP POLICY IF EXISTS "vehicles_garage_delete" ON public.vehicles;
CREATE POLICY "vehicles_garage_select" ON public.vehicles FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "vehicles_garage_insert" ON public.vehicles FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "vehicles_garage_update" ON public.vehicles FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "vehicles_garage_delete" ON public.vehicles FOR DELETE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- quotes ----------
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quotes_garage_select" ON public.quotes;
DROP POLICY IF EXISTS "quotes_garage_insert" ON public.quotes;
DROP POLICY IF EXISTS "quotes_garage_update" ON public.quotes;
DROP POLICY IF EXISTS "quotes_garage_delete" ON public.quotes;
CREATE POLICY "quotes_garage_select" ON public.quotes FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quotes_garage_insert" ON public.quotes FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quotes_garage_update" ON public.quotes FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quotes_garage_delete" ON public.quotes FOR DELETE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- quote_items ----------
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "quote_items_garage_select" ON public.quote_items;
DROP POLICY IF EXISTS "quote_items_garage_insert" ON public.quote_items;
DROP POLICY IF EXISTS "quote_items_garage_update" ON public.quote_items;
DROP POLICY IF EXISTS "quote_items_garage_delete" ON public.quote_items;
CREATE POLICY "quote_items_garage_select" ON public.quote_items FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quote_items_garage_insert" ON public.quote_items FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quote_items_garage_update" ON public.quote_items FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quote_items_garage_delete" ON public.quote_items FOR DELETE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- quick_tasks ----------
DROP POLICY IF EXISTS "Allow authenticated select quick_tasks" ON public.quick_tasks;
DROP POLICY IF EXISTS "Allow authenticated insert quick_tasks" ON public.quick_tasks;
DROP POLICY IF EXISTS "Allow authenticated update quick_tasks" ON public.quick_tasks;
DROP POLICY IF EXISTS "Allow authenticated delete quick_tasks" ON public.quick_tasks;
CREATE POLICY "quick_tasks_garage_select" ON public.quick_tasks FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quick_tasks_garage_insert" ON public.quick_tasks FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quick_tasks_garage_update" ON public.quick_tasks FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "quick_tasks_garage_delete" ON public.quick_tasks FOR DELETE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));

-- ---------- planning_assignments ----------
DROP POLICY IF EXISTS "Allow authenticated select planning_assignments" ON public.planning_assignments;
DROP POLICY IF EXISTS "Allow authenticated insert planning_assignments" ON public.planning_assignments;
DROP POLICY IF EXISTS "Allow authenticated update planning_assignments" ON public.planning_assignments;
DROP POLICY IF EXISTS "Allow authenticated delete planning_assignments" ON public.planning_assignments;
CREATE POLICY "planning_assignments_garage_select" ON public.planning_assignments FOR SELECT TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "planning_assignments_garage_insert" ON public.planning_assignments FOR INSERT TO authenticated
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "planning_assignments_garage_update" ON public.planning_assignments FOR UPDATE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()))
  WITH CHECK (garage_id IN (SELECT current_user_garage_ids()));
CREATE POLICY "planning_assignments_garage_delete" ON public.planning_assignments FOR DELETE TO authenticated
  USING (garage_id IN (SELECT current_user_garage_ids()));
