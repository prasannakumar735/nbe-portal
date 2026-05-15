-- Calendar event reminder tracking.
-- Records when the 24-hour and 2-hour reminder emails were sent so the cron
-- never re-sends them even if it runs multiple times within the same window.

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.calendar_events.reminder_24h_sent_at IS
  'Timestamp when the 24-hour advance reminder email was dispatched (NULL = not yet sent).';

COMMENT ON COLUMN public.calendar_events.reminder_2h_sent_at IS
  'Timestamp when the 2-hour advance reminder email was dispatched (NULL = not yet sent).';

-- Partial index speeds up the cron query: only non-cancelled, non-full-day future events that still need reminders.
CREATE INDEX IF NOT EXISTS idx_calendar_events_reminder_pending
  ON public.calendar_events(date, start_time)
  WHERE is_full_day = false
    AND status NOT IN ('cancelled', 'completed')
    AND (reminder_24h_sent_at IS NULL OR reminder_2h_sent_at IS NULL);
