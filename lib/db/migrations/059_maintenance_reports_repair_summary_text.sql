-- Technician-entered / auto-generated repair summary text rendered in PDFs.
ALTER TABLE public.maintenance_reports
ADD COLUMN IF NOT EXISTS repair_summary_text TEXT NULL;

