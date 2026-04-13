-- 031 — Fix infinite recursion on profiles RLS via elevation side table
--
-- Rule: Policies on `profiles` must NOT `SELECT` from `profiles` (circular dependency).
-- Pattern: `manager_admin_elevation` holds one row per manager/admin; synced from `profiles.role`
--   by trigger. Policies use `EXISTS (SELECT 1 FROM manager_admin_elevation WHERE user_id = auth.uid())`.
-- Timesheet policies: Replaced direct `profiles` scans with the same elevation pattern.

CREATE TABLE IF NOT EXISTS public.manager_admin_elevation (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
);

COMMENT ON TABLE public.manager_admin_elevation IS
  'Users allowed to read all profiles (manager/admin). Kept in sync from profiles.role via trigger.';

ALTER TABLE public.manager_admin_elevation ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.manager_admin_elevation FROM PUBLIC;
GRANT SELECT ON public.manager_admin_elevation TO authenticated;

-- Policy: each user may read only their own elevation row (sufficient for EXISTS (...) in other policies)
DROP POLICY IF EXISTS "manager_elevation_select_own" ON public.manager_admin_elevation;
CREATE POLICY "manager_elevation_select_own"
  ON public.manager_admin_elevation FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Backfill from existing profiles
INSERT INTO public.manager_admin_elevation (user_id)
SELECT id FROM public.profiles
WHERE role IN ('manager', 'admin')
ON CONFLICT (user_id) DO NOTHING;

-- Keep elevation in sync when profiles.role changes
CREATE OR REPLACE FUNCTION public.sync_manager_admin_elevation_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.manager_admin_elevation WHERE user_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.role IN ('manager', 'admin') THEN
    INSERT INTO public.manager_admin_elevation (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.manager_admin_elevation WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_sync_manager_elevation ON public.profiles;
CREATE TRIGGER trg_profiles_sync_manager_elevation
  AFTER INSERT OR UPDATE OF role OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_manager_admin_elevation_from_profile();

-- profiles SELECT: remove every SELECT policy (including legacy 024 names) then add one non-recursive policy
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT p.polname AS name
    FROM pg_policy p
    JOIN pg_class c ON p.polrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND c.relname = 'profiles'
      AND p.polcmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.name);
  END LOOP;
END $$;

-- Policy: users see their own profile row OR any row if they are manager/admin (via elevation table)
CREATE POLICY "profiles_select_own_or_elevated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.manager_admin_elevation m
      WHERE m.user_id = auth.uid()
    )
  );

-- is_manager_or_admin(): read elevation table only (safe for use from other policies)
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manager_admin_elevation m
    WHERE m.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_manager_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

COMMENT ON FUNCTION public.is_manager_or_admin() IS
  'True if current user is in manager_admin_elevation (synced from profiles.role).';

-- Timesheet policies: stop querying profiles here (same recursion class when combined with profiles RLS)
-- Policy: managers/admins read all weekly timesheets (approval workflows)
DROP POLICY IF EXISTS "Managers read all weekly timesheets" ON public.employee_weekly_timesheets;
CREATE POLICY "Managers read all weekly timesheets"
  ON public.employee_weekly_timesheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.manager_admin_elevation m WHERE m.user_id = auth.uid())
  );

-- Policy: managers/admins read all line-level timesheet entries
DROP POLICY IF EXISTS "Managers read all timesheet entries" ON public.employee_timesheet_entries;
CREATE POLICY "Managers read all timesheet entries"
  ON public.employee_timesheet_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.manager_admin_elevation m WHERE m.user_id = auth.uid())
  );

-- Policy: managers/admins may update another user's weekly sheet (e.g. approve/reject), not their own row here
DROP POLICY IF EXISTS "Managers update others weekly timesheets for approval" ON public.employee_weekly_timesheets;
CREATE POLICY "Managers update others weekly timesheets for approval"
  ON public.employee_weekly_timesheets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.manager_admin_elevation m WHERE m.user_id = auth.uid())
    AND user_id <> auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.manager_admin_elevation m WHERE m.user_id = auth.uid())
    AND user_id <> auth.uid()
  );
