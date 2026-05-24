-- Multi-assignee calendar events: join table + RLS-safe helpers + multi job-cards per event.
-- Preserve calendar_events.assigned_to as legacy primary (first assignee).

-- ---------------------------------------------------------------------------
-- calendar_event_assignees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.calendar_event_assignees (
  event_id UUID NOT NULL REFERENCES public.calendar_events (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_assignees_event ON public.calendar_event_assignees (event_id);
CREATE INDEX IF NOT EXISTS idx_calendar_event_assignees_user ON public.calendar_event_assignees (user_id);

COMMENT ON TABLE public.calendar_event_assignees IS
  'Many-to-many link between calendar events and assigned users (supplements assigned_to legacy column).';

-- ---------------------------------------------------------------------------
-- job_cards: allow one row per event per technician (formerly one per event)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_job_cards_one_per_event;
CREATE UNIQUE INDEX IF NOT EXISTS idx_job_cards_event_technician
  ON public.job_cards (event_id, technician_id)
  WHERE event_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Backfill assignees from legacy column
-- ---------------------------------------------------------------------------
INSERT INTO public.calendar_event_assignees (event_id, user_id)
SELECT id, assigned_to FROM public.calendar_events
WHERE assigned_to IS NOT NULL
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers (avoid RLS recursion between calendar_events and assignees)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calendar_assignee_contains_user(p_event_id uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_event_assignees ca
    WHERE ca.event_id = p_event_id AND ca.user_id = p_user
  );
$$;

CREATE OR REPLACE FUNCTION public.user_attends_calendar_event(eid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
      SELECT 1
      FROM public.calendar_events e
      WHERE e.id = eid
        AND (
          e.assigned_to = (SELECT auth.uid())
          OR public.is_manager_or_admin()
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.calendar_event_assignees ca
      WHERE ca.event_id = eid AND ca.user_id = (SELECT auth.uid())
    );
$$;

-- Mirror primary assigned_to into join table on insert / assigned_to updates (SECURITY DEFINER bypasses INSERT RLS)
CREATE OR REPLACE FUNCTION public.trg_calendar_events_mirror_primary_assignee_ins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.calendar_event_assignees (event_id, user_id)
  VALUES (NEW.id, NEW.assigned_to)
  ON CONFLICT (event_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_events_mirror_primary_assignee_insert ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_mirror_primary_assignee_insert
  AFTER INSERT ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_calendar_events_mirror_primary_assignee_ins();

CREATE OR REPLACE FUNCTION public.trg_calendar_events_mirror_primary_assignee_upd()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.calendar_event_assignees (event_id, user_id)
    VALUES (NEW.id, NEW.assigned_to)
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calendar_events_mirror_primary_assignee_update ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_mirror_primary_assignee_update
  AFTER UPDATE OF assigned_to ON public.calendar_events
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_calendar_events_mirror_primary_assignee_upd();

-- ---------------------------------------------------------------------------
-- RLS: calendar_events — allow attendees via join membership
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "calendar_events_select" ON public.calendar_events;
CREATE POLICY "calendar_events_select"
  ON public.calendar_events FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR public.is_manager_or_admin()
    OR public.calendar_assignee_contains_user(id, auth.uid())
  );

-- ---------------------------------------------------------------------------
-- RLS: calendar_event_assignees
-- ---------------------------------------------------------------------------
ALTER TABLE public.calendar_event_assignees ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.calendar_event_assignees FROM PUBLIC;
GRANT SELECT ON public.calendar_event_assignees TO authenticated;
GRANT INSERT, DELETE ON public.calendar_event_assignees TO authenticated;

DROP POLICY IF EXISTS "calendar_event_assignees_select" ON public.calendar_event_assignees;
CREATE POLICY "calendar_event_assignees_select"
  ON public.calendar_event_assignees FOR SELECT
  TO authenticated
  USING (public.user_attends_calendar_event(event_id));

DROP POLICY IF EXISTS "calendar_event_assignees_insert" ON public.calendar_event_assignees;
CREATE POLICY "calendar_event_assignees_insert"
  ON public.calendar_event_assignees FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "calendar_event_assignees_delete" ON public.calendar_event_assignees;
CREATE POLICY "calendar_event_assignees_delete"
  ON public.calendar_event_assignees FOR DELETE
  TO authenticated
  USING (public.is_manager_or_admin());
