-- User management: optional phone, soft-disable flag, manager updates, self-update limits.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.phone IS 'Optional contact phone for portal staff';
COMMENT ON COLUMN public.profiles.is_active IS 'When false, user cannot use the portal (soft disable)';

UPDATE public.profiles SET is_active = true WHERE is_active IS NULL;

-- Auto-maintain updated_at on change
CREATE OR REPLACE FUNCTION public.touch_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_profiles_updated_at();

-- Replace single "own row" UPDATE policy with: managers can update any row; users can update own row.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "profiles_update_manager_or_admin"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.manager_admin_elevation m
      WHERE m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.manager_admin_elevation m
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "profiles_update_own_basic"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Non-elevated users cannot change role or active flag on their own row (managers exempt above).
CREATE OR REPLACE FUNCTION public.profiles_enforce_self_update_limits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  elevated boolean;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  elevated := EXISTS (
    SELECT 1 FROM public.manager_admin_elevation m
    WHERE m.user_id = auth.uid()
  );

  IF elevated THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.id <> auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'You cannot change your own active status';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.profiles_enforce_self_update_limits() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_profiles_enforce_self_limits ON public.profiles;
CREATE TRIGGER trg_profiles_enforce_self_limits
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_enforce_self_update_limits();
