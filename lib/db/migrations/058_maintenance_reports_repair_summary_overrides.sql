-- Add optional technician overrides for the auto-generated repairs summary page.
ALTER TABLE public.maintenance_reports
ADD COLUMN IF NOT EXISTS repair_summary_overrides JSONB NULL;

