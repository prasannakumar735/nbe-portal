-- Fix profiles SELECT RLS: self-referential EXISTS on profiles can cause infinite recursion.
-- Use SECURITY DEFINER helper so role checks do not re-enter RLS on the same table.

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_manager_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers read all profiles" ON public.profiles;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_manager_or_admin());
