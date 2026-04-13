-- Persist manager-entered consolidated "Total Doors Inspected" for merged PDFs (re-download)

ALTER TABLE IF EXISTS public.merged_reports
  ADD COLUMN IF NOT EXISTS total_doors_inspected INTEGER NULL;

COMMENT ON COLUMN public.merged_reports.total_doors_inspected IS
  'Consolidated count shown once on the first page of merged maintenance PDFs';
