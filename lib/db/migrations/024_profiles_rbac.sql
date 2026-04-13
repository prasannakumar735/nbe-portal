-- RBAC: profiles columns (full_name, role) + RLS
-- Roles: technician | employee (legacy) | manager | admin
-- Assumes public.profiles exists (Supabase Auth / prior setup). Greenfield: create minimal table.

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS role TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('technician', 'employee', 'manager', 'admin'));

UPDATE public.profiles
SET full_name = TRIM(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')))
WHERE (full_name IS NULL OR TRIM(full_name) = '')
  AND (first_name IS NOT NULL OR last_name IS NOT NULL);

COMMENT ON TABLE public.profiles IS 'App user profile; role drives RBAC (technician/manager/admin)';
COMMENT ON COLUMN public.profiles.full_name IS 'Display name; optional if first_name/last_name used';
COMMENT ON COLUMN public.profiles.role IS 'technician | employee (legacy) | manager | admin';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Managers read all profiles" ON public.profiles;
CREATE POLICY "Managers read all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('manager', 'admin')
    )
  );

-- Technicians can update only their own row (e.g. display name) — optional; tighten if you use admin-only edits
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
