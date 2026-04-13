-- Weekly timesheet (one row per user per week) + line entries with time ranges.
-- Status: draft | submitted | approved

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS employee_weekly_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  total_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  billable_hours NUMERIC(10, 4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  submitted_at TIMESTAMPTZ NULL,
  approved_at TIMESTAMPTZ NULL,
  approved_by UUID NULL REFERENCES auth.users (id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_employee_weekly_timesheets_user ON employee_weekly_timesheets (user_id);
CREATE INDEX IF NOT EXISTS idx_employee_weekly_timesheets_week ON employee_weekly_timesheets (week_start_date);

CREATE TABLE IF NOT EXISTS employee_timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timesheet_id UUID NOT NULL REFERENCES employee_weekly_timesheets (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  client_id UUID NULL REFERENCES clients (id) ON DELETE SET NULL,
  location_id UUID NULL REFERENCES client_locations (id) ON DELETE SET NULL,
  work_type_level1_id UUID NULL REFERENCES work_type_level1 (id) ON DELETE SET NULL,
  work_type_level2_id UUID NULL REFERENCES work_type_level2 (id) ON DELETE SET NULL,
  task TEXT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0 AND break_minutes < 24 * 60),
  total_hours NUMERIC(10, 4) NOT NULL CHECK (total_hours >= 0 AND total_hours <= 24),
  billable BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT NULL,
  gps_start JSONB NULL,
  gps_end JSONB NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_timesheet_entries_sheet ON employee_timesheet_entries (timesheet_id);
CREATE INDEX IF NOT EXISTS idx_employee_timesheet_entries_user_date ON employee_timesheet_entries (user_id, entry_date);

DROP TRIGGER IF EXISTS trg_employee_weekly_timesheets_updated_at ON employee_weekly_timesheets;
CREATE TRIGGER trg_employee_weekly_timesheets_updated_at
  BEFORE UPDATE ON employee_weekly_timesheets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_employee_timesheet_entries_updated_at ON employee_timesheet_entries;
CREATE TRIGGER trg_employee_timesheet_entries_updated_at
  BEFORE UPDATE ON employee_timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE employee_weekly_timesheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own weekly timesheets"
  ON employee_weekly_timesheets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own weekly timesheets"
  ON employee_weekly_timesheets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own weekly timesheets"
  ON employee_weekly_timesheets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own timesheet entries"
  ON employee_timesheet_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert timesheet entries when week is draft"
  ON employee_timesheet_entries FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM employee_weekly_timesheets w
      WHERE w.id = timesheet_id AND w.user_id = auth.uid() AND w.status = 'draft'
    )
  );

CREATE POLICY "Users update timesheet entries when week is draft"
  ON employee_timesheet_entries FOR UPDATE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM employee_weekly_timesheets w
      WHERE w.id = timesheet_id AND w.user_id = auth.uid() AND w.status = 'draft'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM employee_weekly_timesheets w
      WHERE w.id = timesheet_id AND w.user_id = auth.uid() AND w.status = 'draft'
    )
  );

CREATE POLICY "Users delete timesheet entries when week is draft"
  ON employee_timesheet_entries FOR DELETE
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM employee_weekly_timesheets w
      WHERE w.id = timesheet_id AND w.user_id = auth.uid() AND w.status = 'draft'
    )
  );

COMMENT ON TABLE employee_weekly_timesheets IS 'One timesheet per user per ISO week (week_start_date = Monday)';
COMMENT ON TABLE employee_timesheet_entries IS 'Time ranges per day; total_hours computed client-side and validated server-side';
