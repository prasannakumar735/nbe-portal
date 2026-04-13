-- Speed up manager reports / cascading filters on employee_timesheet_entries

CREATE INDEX IF NOT EXISTS idx_employee_timesheet_entries_client_date
  ON public.employee_timesheet_entries (client_id, entry_date)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employee_timesheet_entries_location_date
  ON public.employee_timesheet_entries (location_id, entry_date)
  WHERE location_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_employee_timesheet_entries_scope_job
  ON public.employee_timesheet_entries (client_id, location_id, entry_date, work_type_level1_id)
  WHERE work_type_level1_id IS NOT NULL;
