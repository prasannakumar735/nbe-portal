-- Idempotent offline sync support

ALTER TABLE IF EXISTS public.maintenance_reports
  ADD COLUMN IF NOT EXISTS offline_id TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_offline_id
  ON public.maintenance_reports (offline_id)
  WHERE offline_id IS NOT NULL AND btrim(offline_id) <> '';

