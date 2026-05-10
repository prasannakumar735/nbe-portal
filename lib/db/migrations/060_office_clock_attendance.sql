-- Office QR clock in/out → optional auto line on weekly timesheet (Melbourne calendar day).

CREATE TABLE IF NOT EXISTS public.office_clock_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  client_id UUID NULL REFERENCES public.clients (id) ON DELETE SET NULL,
  location_id UUID NULL REFERENCES public.client_locations (id) ON DELETE SET NULL,
  work_type_level1_id UUID NULL REFERENCES public.work_type_level1 (id) ON DELETE SET NULL,
  work_type_level2_id UUID NULL REFERENCES public.work_type_level2 (id) ON DELETE SET NULL,
  default_break_minutes INTEGER NOT NULL DEFAULT 30
    CHECK (default_break_minutes >= 0 AND default_break_minutes < 24 * 60),
  default_task TEXT NULL,
  billable BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_clock_sites_active ON public.office_clock_sites (is_active) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS public.office_attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES public.office_clock_sites (id) ON DELETE RESTRICT,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ NULL,
  timesheet_entry_id UUID NULL REFERENCES public.employee_timesheet_entries (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_office_attendance_user_in ON public.office_attendance_sessions (user_id, clock_in_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS office_attendance_one_open_session_per_user
  ON public.office_attendance_sessions (user_id)
  WHERE clock_out_at IS NULL;

COMMENT ON TABLE public.office_clock_sites IS 'Maps QR ?site= slug to timesheet defaults; set client_id/location_id/work types before use.';
COMMENT ON TABLE public.office_attendance_sessions IS 'Open session = clocked in; closing writes employee_timesheet_entries line.';

ALTER TABLE public.office_clock_sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_attendance_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "office_clock_sites_select_active" ON public.office_clock_sites;
CREATE POLICY "office_clock_sites_select_active"
  ON public.office_clock_sites FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "office_attendance_sessions_select_own" ON public.office_attendance_sessions;
CREATE POLICY "office_attendance_sessions_select_own"
  ON public.office_attendance_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "office_attendance_sessions_insert_own" ON public.office_attendance_sessions;
CREATE POLICY "office_attendance_sessions_insert_own"
  ON public.office_attendance_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "office_attendance_sessions_update_own" ON public.office_attendance_sessions;
CREATE POLICY "office_attendance_sessions_update_own"
  ON public.office_attendance_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO public.office_clock_sites (slug, display_name, is_active)
VALUES ('hq', 'NBE Office', TRUE)
ON CONFLICT (slug) DO NOTHING;

-- After deploy, set timesheet defaults for slug `hq`, e.g.:
-- UPDATE public.office_clock_sites SET
--   client_id = '<clients.id>',
--   location_id = '<client_locations.id>',
--   work_type_level1_id = '<work_type_level1.id>',
--   work_type_level2_id = '<work_type_level2.id>',
--   default_break_minutes = 30,
--   default_task = 'Office',
--   billable = FALSE
-- WHERE slug = 'hq';
--
-- Local dev alternative (Next.js server only): same four UUIDs in .env.local as
-- OFFICE_CLOCK_CLIENT_ID, OFFICE_CLOCK_LOCATION_ID, OFFICE_CLOCK_WORK_TYPE_LEVEL1_ID,
-- OFFICE_CLOCK_WORK_TYPE_LEVEL2_ID (see lib/officeClock/envSiteFallback.ts).
