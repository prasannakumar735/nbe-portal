-- RLS policies for public tables that had ENABLE ROW LEVEL SECURITY but no policies
-- (blocked JWT access; service role continues to bypass RLS).
--
-- References: lib/db/schema.sql (weekly_submissions), 045_client_users.sql, 010_create_service_quotes_tables.sql,
-- 018_create_merged_reports_table.sql, 011–013 maintenance_reports, 044 job_cards pattern.
-- Does NOT alter password_reset_tokens (053 keeps server-oriented access; RLS may stay OFF).
--
-- Run in Supabase SQL Editor after backup. Idempotent: DROP POLICY IF EXISTS before CREATE.

-- Ensure email columns exist (app writes these; safe if already present)
ALTER TABLE public.maintenance_reports
  ADD COLUMN IF NOT EXISTS technician_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS submitter_email TEXT NULL;

-- ---------------------------------------------------------------------------
-- Helper: JWT-visible maintenance report (manager OR technician email match)
-- ---------------------------------------------------------------------------
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
          AND lower(trim(r.technician_email)) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
        OR (
          r.submitter_email IS NOT NULL
          AND lower(trim(r.submitter_email)) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.user_can_access_maintenance_report(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_maintenance_report(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- weekly_submissions (columns per lib/db/schema.sql: employee_id, status, …)
-- Mirrors employee_weekly_timesheets patterns (own row + managers).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "weekly_submissions_select_own" ON public.weekly_submissions;
CREATE POLICY "weekly_submissions_select_own"
  ON public.weekly_submissions FOR SELECT TO authenticated
  USING (employee_id = auth.uid());

DROP POLICY IF EXISTS "weekly_submissions_select_managers" ON public.weekly_submissions;
CREATE POLICY "weekly_submissions_select_managers"
  ON public.weekly_submissions FOR SELECT TO authenticated
  USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "weekly_submissions_insert_own" ON public.weekly_submissions;
CREATE POLICY "weekly_submissions_insert_own"
  ON public.weekly_submissions FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "weekly_submissions_update_own" ON public.weekly_submissions;
CREATE POLICY "weekly_submissions_update_own"
  ON public.weekly_submissions FOR UPDATE TO authenticated
  USING (employee_id = auth.uid())
  WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "weekly_submissions_update_managers_others" ON public.weekly_submissions;
CREATE POLICY "weekly_submissions_update_managers_others"
  ON public.weekly_submissions FOR UPDATE TO authenticated
  USING (
    public.is_manager_or_admin()
    AND employee_id IS DISTINCT FROM auth.uid()
  )
  WITH CHECK (
    public.is_manager_or_admin()
    AND employee_id IS DISTINCT FROM auth.uid()
  );

-- ---------------------------------------------------------------------------
-- client_users (id = auth.users.id; 045 — add JWT read for own row + managers)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_users_select_own" ON public.client_users;
CREATE POLICY "client_users_select_own"
  ON public.client_users FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "client_users_select_managers" ON public.client_users;
CREATE POLICY "client_users_select_managers"
  ON public.client_users FOR SELECT TO authenticated
  USING (public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- contacts (admin/manager CRUD; add anon read separately if QR needs public access)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "contacts_manager_all" ON public.contacts;
CREATE POLICY "contacts_manager_all"
  ON public.contacts FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- Service quotes (no per-user columns in 010 — staff/manager via app; restrict JWT)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "quotes_manager_all" ON public.quotes;
CREATE POLICY "quotes_manager_all"
  ON public.quotes FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "quote_items_manager_all" ON public.quote_items;
CREATE POLICY "quote_items_manager_all"
  ON public.quote_items FOR ALL TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- merged_reports (created_by → profiles per 018)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "merged_reports_select" ON public.merged_reports;
CREATE POLICY "merged_reports_select"
  ON public.merged_reports FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "merged_reports_insert" ON public.merged_reports;
CREATE POLICY "merged_reports_insert"
  ON public.merged_reports FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.is_manager_or_admin()
  );

DROP POLICY IF EXISTS "merged_reports_update" ON public.merged_reports;
CREATE POLICY "merged_reports_update"
  ON public.merged_reports FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "merged_reports_delete" ON public.merged_reports;
CREATE POLICY "merged_reports_delete"
  ON public.merged_reports FOR DELETE TO authenticated
  USING (public.is_manager_or_admin());

-- ---------------------------------------------------------------------------
-- PVC quote satellite tables (read-only for authenticated; writes via service role in app)
-- Only create if table exists (some DBs add columns outside repo migrations).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pvc_quote_items'
  ) THEN
    EXECUTE $p$
      DROP POLICY IF EXISTS "pvc_quote_items_authenticated_read" ON public.pvc_quote_items;
      CREATE POLICY "pvc_quote_items_authenticated_read"
        ON public.pvc_quote_items FOR SELECT TO authenticated
        USING (true);
    $p$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'pvc_sheet_specs'
  ) THEN
    EXECUTE $p$
      DROP POLICY IF EXISTS "pvc_sheet_specs_authenticated_read" ON public.pvc_sheet_specs;
      CREATE POLICY "pvc_sheet_specs_authenticated_read"
        ON public.pvc_sheet_specs FOR SELECT TO authenticated
        USING (true);
    $p$;
  END IF;
END $$;

-- pvc_quotes: align with other PVC catalog reads (003 pattern)
DROP POLICY IF EXISTS "pvc_quotes_authenticated_read" ON public.pvc_quotes;
CREATE POLICY "pvc_quotes_authenticated_read"
  ON public.pvc_quotes FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- maintenance_reports + children (technician_email / submitter_email per app usage)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "maintenance_reports_jwt_access" ON public.maintenance_reports;
CREATE POLICY "maintenance_reports_jwt_access"
  ON public.maintenance_reports FOR ALL TO authenticated
  USING (
    public.is_manager_or_admin()
    OR (
      technician_email IS NOT NULL
      AND lower(trim(technician_email)) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    OR (
      submitter_email IS NOT NULL
      AND lower(trim(submitter_email)) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  )
  WITH CHECK (
    public.is_manager_or_admin()
    OR (
      technician_email IS NOT NULL
      AND lower(trim(technician_email)) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    OR (
      submitter_email IS NOT NULL
      AND lower(trim(submitter_email)) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
  );

DROP POLICY IF EXISTS "maintenance_doors_jwt_access" ON public.maintenance_doors;
CREATE POLICY "maintenance_doors_jwt_access"
  ON public.maintenance_doors FOR ALL TO authenticated
  USING (public.user_can_access_maintenance_report(maintenance_doors.report_id))
  WITH CHECK (public.user_can_access_maintenance_report(maintenance_doors.report_id));

DROP POLICY IF EXISTS "maintenance_checklist_jwt_access" ON public.maintenance_checklist;
CREATE POLICY "maintenance_checklist_jwt_access"
  ON public.maintenance_checklist FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.maintenance_doors d
      WHERE d.id = maintenance_checklist.door_id
        AND public.user_can_access_maintenance_report(d.report_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.maintenance_doors d
      WHERE d.id = maintenance_checklist.door_id
        AND public.user_can_access_maintenance_report(d.report_id)
    )
  );

DROP POLICY IF EXISTS "maintenance_photos_jwt_access" ON public.maintenance_photos;
CREATE POLICY "maintenance_photos_jwt_access"
  ON public.maintenance_photos FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.maintenance_doors d
      WHERE d.id = maintenance_photos.door_id
        AND public.user_can_access_maintenance_report(d.report_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.maintenance_doors d
      WHERE d.id = maintenance_photos.door_id
        AND public.user_can_access_maintenance_report(d.report_id)
    )
  );

-- maintenance_report_photos: schema not in repo — if table exists, require manager OR linked report access
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'maintenance_report_photos'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'maintenance_report_photos' AND column_name = 'report_id'
    ) THEN
      EXECUTE $p$
        DROP POLICY IF EXISTS "maintenance_report_photos_jwt_access" ON public.maintenance_report_photos;
        CREATE POLICY "maintenance_report_photos_jwt_access"
          ON public.maintenance_report_photos FOR ALL TO authenticated
          USING (public.user_can_access_maintenance_report(report_id))
          WITH CHECK (public.user_can_access_maintenance_report(report_id));
      $p$;
    ELSE
      EXECUTE $p$
        DROP POLICY IF EXISTS "maintenance_report_photos_manager_only" ON public.maintenance_report_photos;
        CREATE POLICY "maintenance_report_photos_manager_only"
          ON public.maintenance_report_photos FOR ALL TO authenticated
          USING (public.is_manager_or_admin())
          WITH CHECK (public.is_manager_or_admin());
      $p$;
    END IF;
  END IF;
END $$;

COMMENT ON FUNCTION public.user_can_access_maintenance_report(uuid) IS
  'RLS helper: manager/admin OR technician/submitter email matches JWT user email.';
