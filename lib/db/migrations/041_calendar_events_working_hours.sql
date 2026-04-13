-- Enforce field calendar working window 07:00–18:00 for timed events (full-day exempt).

CREATE OR REPLACE FUNCTION public.calendar_events_enforce_working_hours()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sm int;
  dur int;
BEGIN
  IF NEW.is_full_day THEN
    RETURN NEW;
  END IF;

  IF NEW.start_time IS NULL OR NEW.duration_minutes IS NULL THEN
    RETURN NEW;
  END IF;

  sm :=
    EXTRACT(HOUR FROM NEW.start_time)::int * 60
    + EXTRACT(MINUTE FROM NEW.start_time)::int;
  dur := NEW.duration_minutes;

  IF sm < 7 * 60 THEN
    RAISE EXCEPTION 'Start time must be on or after 07:00'
      USING ERRCODE = '23514';
  END IF;

  IF sm >= 18 * 60 THEN
    RAISE EXCEPTION 'Start time must be before 18:00'
      USING ERRCODE = '23514';
  END IF;

  IF sm + dur > 18 * 60 THEN
    RAISE EXCEPTION 'Event must end by 18:00'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_events_working_hours ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_working_hours
  BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.calendar_events_enforce_working_hours();
