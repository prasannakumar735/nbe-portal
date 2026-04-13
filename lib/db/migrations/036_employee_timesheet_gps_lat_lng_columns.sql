-- Denormalised lat/lng columns for reporting, maps, and queries (kept in sync with gps_start / gps_end JSONB).

ALTER TABLE public.employee_timesheet_entries
  ADD COLUMN IF NOT EXISTS gps_start_lat DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS gps_start_lng DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS gps_end_lat DOUBLE PRECISION NULL,
  ADD COLUMN IF NOT EXISTS gps_end_lng DOUBLE PRECISION NULL;

COMMENT ON COLUMN public.employee_timesheet_entries.gps_start_lat IS 'Technician / clock-in latitude (mirrors gps_start.lat)';
COMMENT ON COLUMN public.employee_timesheet_entries.gps_start_lng IS 'Technician / clock-in longitude (mirrors gps_start.lng)';
COMMENT ON COLUMN public.employee_timesheet_entries.gps_end_lat IS 'Job end / clock-out latitude (mirrors gps_end.lat)';
COMMENT ON COLUMN public.employee_timesheet_entries.gps_end_lng IS 'Job end / clock-out longitude (mirrors gps_end.lng)';

UPDATE public.employee_timesheet_entries
SET
  gps_start_lat = COALESCE(gps_start_lat, (NULLIF(trim(gps_start->>'lat'), ''))::double precision),
  gps_start_lng = COALESCE(gps_start_lng, (NULLIF(trim(gps_start->>'lng'), ''))::double precision)
WHERE gps_start IS NOT NULL;

UPDATE public.employee_timesheet_entries
SET
  gps_end_lat = COALESCE(gps_end_lat, (NULLIF(trim(gps_end->>'lat'), ''))::double precision),
  gps_end_lng = COALESCE(gps_end_lng, (NULLIF(trim(gps_end->>'lng'), ''))::double precision)
WHERE gps_end IS NOT NULL;
