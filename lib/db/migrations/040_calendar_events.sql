-- Shared calendar / scheduling: event types, statuses, and field-service scheduling rows.

-- Enums
DO $$ BEGIN
  CREATE TYPE public.event_type_enum AS ENUM ('task', 'block', 'leave', 'meeting');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_status_enum AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  event_type public.event_type_enum NOT NULL DEFAULT 'task',
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  is_full_day BOOLEAN NOT NULL DEFAULT false,
  duration_minutes INTEGER,
  location_text TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  travel_minutes INTEGER NOT NULL DEFAULT 0,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  status public.event_status_enum NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT calendar_events_full_day_times_check CHECK (
    is_full_day = false OR (start_time IS NULL AND end_time IS NULL)
  ),
  CONSTRAINT calendar_events_duration_nonneg CHECK (
    duration_minutes IS NULL OR duration_minutes >= 0
  ),
  CONSTRAINT calendar_events_travel_nonneg CHECK (travel_minutes >= 0),
  CONSTRAINT calendar_events_total_nonneg CHECK (total_minutes >= 0)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON public.calendar_events (date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_to ON public.calendar_events (assigned_to);
CREATE INDEX IF NOT EXISTS idx_calendar_events_assigned_date ON public.calendar_events (assigned_to, date);

COMMENT ON TABLE public.calendar_events IS 'Field service shared calendar events (tasks, blocks, leave, meetings).';

-- updated_at
CREATE OR REPLACE FUNCTION public.touch_calendar_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_calendar_events_updated_at();

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.calendar_events FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;

-- Employees: read rows assigned to them. Managers/admins: read all.
DROP POLICY IF EXISTS "calendar_events_select" ON public.calendar_events;
CREATE POLICY "calendar_events_select"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.is_manager_or_admin()
  );

-- Managers/admins: full CRUD
DROP POLICY IF EXISTS "calendar_events_insert" ON public.calendar_events;
CREATE POLICY "calendar_events_insert"
  ON public.calendar_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "calendar_events_update" ON public.calendar_events;
CREATE POLICY "calendar_events_update"
  ON public.calendar_events FOR UPDATE
  TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "calendar_events_delete" ON public.calendar_events;
CREATE POLICY "calendar_events_delete"
  ON public.calendar_events FOR DELETE
  TO authenticated
  USING (public.is_manager_or_admin());
