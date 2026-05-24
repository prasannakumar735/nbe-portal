-- Optional end date for multi-day full-day calendar tasks (start remains `date`).

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS end_date DATE;

COMMENT ON COLUMN public.calendar_events.end_date IS
  'Last day inclusive for a multi-day task; NULL means single-day (use `date` only).';

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_end_date_gte_date;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_end_date_gte_date CHECK (
    end_date IS NULL OR end_date >= date
  );

ALTER TABLE public.calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_end_date_task_only;

ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_end_date_task_only CHECK (
    end_date IS NULL OR event_type = 'task'::public.event_type_enum
  );

CREATE INDEX IF NOT EXISTS idx_calendar_events_end_date ON public.calendar_events (end_date)
  WHERE end_date IS NOT NULL;
