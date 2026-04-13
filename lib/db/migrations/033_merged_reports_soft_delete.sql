-- Soft delete for merged_reports (recovery + delayed hard purge)

ALTER TABLE IF EXISTS public.merged_reports
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_merged_reports_deleted_at
  ON public.merged_reports (deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN public.merged_reports.deleted_at IS 'When set, report is hidden from active list; PDF remains in storage until hard purge';
COMMENT ON COLUMN public.merged_reports.deleted_by IS 'Profile that soft-deleted this row';
