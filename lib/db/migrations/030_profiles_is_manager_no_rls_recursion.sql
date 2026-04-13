-- 030 — Helper to detect manager/admin without triggering profiles RLS recursion
--
-- Problem: `is_manager_or_admin()` reads `public.profiles`; without bypassing RLS inside the
--   function body, PostgreSQL re-evaluates profiles policies on the inner SELECT → infinite recursion.
-- Fix: `SET row_security = off` for the function body only (PostgreSQL 9.5+).
-- Note: Superseded by 031/032 which use `manager_admin_elevation` instead of scanning `profiles`.

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('manager', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION public.is_manager_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

COMMENT ON FUNCTION public.is_manager_or_admin() IS
  'True if current user is manager/admin; inner profiles read bypasses RLS to avoid recursion.';
