-- 032 — Force a single non-recursive SELECT policy on `profiles` (repair / idempotent)
--
-- Ensures no leftover SELECT policies on `profiles` still subquery `profiles` (infinite recursion).
-- Drops every SELECT-only policy on `public.profiles`, then reapplies one policy using elevation only.
-- Does not remove UPDATE policies (e.g. "Users update own profile").

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

-- Policy: own row OR manager/admin via elevation (never SELECT profiles inside this USING clause)
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

-- Invoker-only: reads manager_admin_elevation (RLS allows user to see own row). No profiles scan.
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
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
  'True if auth.uid() has a row in manager_admin_elevation (synced from profiles.role).';
