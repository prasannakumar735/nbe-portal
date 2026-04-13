-- 028 — Client portal users: link auth user to a client org for merged-report access
--
-- Purpose: Allow `role = client` users with `profiles.client_id` for org-scoped merged-report access.
-- RLS: Policies on `profiles` and related tables are adjusted in 024–026 / 031–032; avoid recursive
--   `SELECT` from `profiles` inside `profiles` policies (see 031).

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('technician', 'employee', 'manager', 'admin', 'client'));

COMMENT ON COLUMN public.profiles.client_id IS 'When role = client, limits merged-report access to this client';

CREATE INDEX IF NOT EXISTS idx_profiles_client_id ON public.profiles (client_id) WHERE client_id IS NOT NULL;
