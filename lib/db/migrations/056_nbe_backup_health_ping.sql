-- Lightweight read used by scripts/backup-check.ts (service role only).
-- Returns database clock for backup connectivity verification.

CREATE OR REPLACE FUNCTION public.nbe_backup_health_ping()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOW();
$$;

REVOKE ALL ON FUNCTION public.nbe_backup_health_ping() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.nbe_backup_health_ping() TO service_role;
