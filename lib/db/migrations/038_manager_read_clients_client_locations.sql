-- When RLS is enabled on clients / client_locations, managers need SELECT for reporting (timecard analytics).
-- No-op if tables are not row-level secured (policy creation is skipped).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'clients'
      AND c.relrowsecurity
  ) THEN
    DROP POLICY IF EXISTS "Managers read clients for reports" ON public.clients;
    CREATE POLICY "Managers read clients for reports"
      ON public.clients FOR SELECT
      TO authenticated
      USING (public.is_manager_or_admin());
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'client_locations'
      AND c.relrowsecurity
  ) THEN
    DROP POLICY IF EXISTS "Managers read client_locations for reports" ON public.client_locations;
    CREATE POLICY "Managers read client_locations for reports"
      ON public.client_locations FOR SELECT
      TO authenticated
      USING (public.is_manager_or_admin());
  END IF;
END $$;
