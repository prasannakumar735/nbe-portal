-- Team scheduler: overlap stack index + optional lane grouping for advanced calendar UI.

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS overlap_position INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS lane_id UUID;

COMMENT ON COLUMN public.calendar_events.overlap_position IS 'UI horizontal stack index for overlapping timed events (0-based).';
COMMENT ON COLUMN public.calendar_events.lane_id IS 'Optional sub-lane / dispatch group (nullable).';
