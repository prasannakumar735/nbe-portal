-- Dual-mode location: structured client/site vs free-text + geocode.

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES public.client_locations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS location_mode TEXT;

UPDATE public.calendar_events
SET location_mode = 'manual'
WHERE location_mode IS NULL;

ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_location_mode_check;
ALTER TABLE public.calendar_events ADD CONSTRAINT calendar_events_location_mode_check
  CHECK (location_mode IN ('client', 'manual'));

ALTER TABLE public.calendar_events ALTER COLUMN location_mode SET DEFAULT 'manual';
ALTER TABLE public.calendar_events ALTER COLUMN location_mode SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calendar_events_client_id ON public.calendar_events (client_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_location_id ON public.calendar_events (location_id);

COMMENT ON COLUMN public.calendar_events.client_id IS 'When location_mode=client, selected client.';
COMMENT ON COLUMN public.calendar_events.location_id IS 'When location_mode=client, selected client_locations row.';
COMMENT ON COLUMN public.calendar_events.location_mode IS 'client = site from client_locations; manual = free text + geocode.';
