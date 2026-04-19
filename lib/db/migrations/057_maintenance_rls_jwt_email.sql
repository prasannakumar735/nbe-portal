-- Fix "permission denied for table users" when RLS evaluates maintenance policies.
-- Subqueries to auth.users() fail for the `authenticated` role in many Supabase setups.
-- Use JWT email claim instead (same value for email match).

CREATE OR REPLACE FUNCTION public.user_can_access_maintenance_report(p_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.maintenance_reports r
    WHERE r.id = p_report_id
      AND (
        public.is_manager_or_admin()
        OR (
          r.technician_email IS NOT NULL
          AND lower(trim(r.technician_email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
        )
        OR (
          r.submitter_email IS NOT NULL
          AND lower(trim(r.submitter_email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
        )
      )
  );
$$;

COMMENT ON FUNCTION public.user_can_access_maintenance_report(uuid) IS
  'RLS helper: manager/admin OR technician/submitter email matches JWT email (no auth.users read).';

DROP POLICY IF EXISTS "maintenance_reports_jwt_access" ON public.maintenance_reports;
CREATE POLICY "maintenance_reports_jwt_access"
  ON public.maintenance_reports FOR ALL TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (
      technician_email IS NOT NULL
      AND lower(trim(technician_email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
    )
    OR (
      submitter_email IS NOT NULL
      AND lower(trim(submitter_email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
    )
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      technician_email IS NOT NULL
      AND lower(trim(technician_email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
    )
    OR (
      submitter_email IS NOT NULL
      AND lower(trim(submitter_email)) = lower(trim(COALESCE(auth.jwt() ->> 'email', '')))
    )
  );
