-- Human-readable reverse-geocoded labels for GPS points on timesheet lines.

ALTER TABLE employee_timesheet_entries
  ADD COLUMN IF NOT EXISTS gps_start_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS gps_start_meta JSONB NULL,
  ADD COLUMN IF NOT EXISTS gps_end_address TEXT NULL,
  ADD COLUMN IF NOT EXISTS gps_end_meta JSONB NULL;

COMMENT ON COLUMN employee_timesheet_entries.gps_start_address IS 'Reverse-geocoded single-line address for gps_start';
COMMENT ON COLUMN employee_timesheet_entries.gps_start_meta IS 'Structured address parts (suburb, state, postcode, country, etc.)';
COMMENT ON COLUMN employee_timesheet_entries.gps_end_address IS 'Reverse-geocoded single-line address for gps_end';
COMMENT ON COLUMN employee_timesheet_entries.gps_end_meta IS 'Structured address parts for gps_end';
