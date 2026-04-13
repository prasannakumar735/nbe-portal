-- Individual maintenance report client access (QR / share link), aligned with merged_reports pattern.

ALTER TABLE public.maintenance_reports
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.maintenance_reports.share_token IS 'Opaque token for /report/view/{token}; only set when manager approves';
COMMENT ON COLUMN public.maintenance_reports.approved IS 'True when report is approved for client sharing (mirrors status=approved after workflow)';
COMMENT ON COLUMN public.maintenance_reports.approved_at IS 'When manager approved the report for client access';

CREATE INDEX IF NOT EXISTS idx_maintenance_reports_share_token
  ON public.maintenance_reports (share_token)
  WHERE share_token IS NOT NULL;

-- Backfill: existing approved rows get approved flag (token generated on next save or remain null until re-approved)
UPDATE public.maintenance_reports
SET approved = (status = 'approved'),
    approved_at = COALESCE(approved_at, updated_at)
WHERE status = 'approved' AND approved IS DISTINCT FROM true;
