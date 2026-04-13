-- Rejected status + audit columns; RLS so managers/admins can read/update timesheets for approval.

ALTER TABLE employee_weekly_timesheets DROP CONSTRAINT IF EXISTS employee_weekly_timesheets_status_check;
ALTER TABLE employee_weekly_timesheets ADD CONSTRAINT employee_weekly_timesheets_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'rejected'));

ALTER TABLE employee_weekly_timesheets
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS rejected_by UUID NULL REFERENCES auth.users (id) ON DELETE SET NULL;

COMMENT ON COLUMN employee_weekly_timesheets.rejected_at IS 'When manager rejected the submission';
COMMENT ON COLUMN employee_weekly_timesheets.rejected_by IS 'Manager user who rejected';

-- Employees may fix lines when week is rejected (same as draft for entry CRUD)
DROP POLICY IF EXISTS "Users insert timesheet entries when week is draft" ON employee_timesheet_entries;
CREATE POLICY "Users insert timesheet entries when week is draft"
  ON employee_timesheet_entries FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM employee_weekly_timesheets w
      WHERE w.id = timesheet_id AND w.user_id = auth.uid() AND w.status IN ('draft', 'rejected')
    )
  );

DROP POLICY IF EXISTS "Users update timesheet entries when week is draft" ON employee_timesheet_entries;
CREATE POLICY "Users update timesheet entries when week is draft"
  ON employee_timesheet_entries FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM employee_weekly_timesheets w
      WHERE w.id = timesheet_id AND w.user_id = auth.uid() AND w.status IN ('draft', 'rejected')
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM employee_weekly_timesheets w
      WHERE w.id = timesheet_id AND w.user_id = auth.uid() AND w.status IN ('draft', 'rejected')
    )
  );

DROP POLICY IF EXISTS "Users delete timesheet entries when week is draft" ON employee_timesheet_entries;
CREATE POLICY "Users delete timesheet entries when week is draft"
  ON employee_timesheet_entries FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM employee_weekly_timesheets w
      WHERE w.id = timesheet_id AND w.user_id = auth.uid() AND w.status IN ('draft', 'rejected')
    )
  );

-- Managers / admins: read any weekly timesheet (OR with existing own-row policy)
CREATE POLICY "Managers read all weekly timesheets"
  ON employee_weekly_timesheets FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
  );

-- Managers / admins: read any timesheet line (for review)
CREATE POLICY "Managers read all timesheet entries"
  ON employee_timesheet_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
  );

-- Managers / admins: update another user''s weekly sheet for approve/reject (not own draft lines)
CREATE POLICY "Managers update others weekly timesheets for approval"
  ON employee_weekly_timesheets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
    AND user_id <> auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager'))
    AND user_id <> auth.uid()
  );
