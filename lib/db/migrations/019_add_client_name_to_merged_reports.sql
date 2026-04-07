-- Store client_name directly on merged_reports for reliable dashboard display

ALTER TABLE IF EXISTS public.merged_reports
  ADD COLUMN IF NOT EXISTS client_name TEXT NULL;

-- Backfill from clients table when possible
UPDATE public.merged_reports mr
SET client_name = NULLIF(btrim(c.name), '')
FROM public.clients c
WHERE mr.client_id = c.id
  AND (mr.client_name IS NULL OR btrim(mr.client_name) = '');

-- Ensure empty strings are normalized to NULL
UPDATE public.merged_reports
SET client_name = NULL
WHERE client_name IS NOT NULL AND btrim(client_name) = '';

