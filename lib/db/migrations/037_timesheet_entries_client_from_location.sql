-- Backfill client_id when a line has a site (location) but client was never set (common when UI only enforced location).

UPDATE public.employee_timesheet_entries e
SET client_id = cl.client_id
FROM public.client_locations cl
WHERE e.location_id = cl.id
  AND e.client_id IS NULL
  AND cl.client_id IS NOT NULL;
