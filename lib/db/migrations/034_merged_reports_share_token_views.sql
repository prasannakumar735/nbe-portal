-- Public share token (text) + optional analytics for merged report links

ALTER TABLE IF EXISTS public.merged_reports
  ADD COLUMN IF NOT EXISTS share_token TEXT,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.merged_reports.share_token IS 'Unguessable token for /report/view/{token}; may mirror access_token UUID as text';
COMMENT ON COLUMN public.merged_reports.last_viewed_at IS 'Last time an authenticated client opened the viewer';
COMMENT ON COLUMN public.merged_reports.view_count IS 'Number of client viewer loads (best-effort)';

UPDATE public.merged_reports
SET share_token = access_token::text
WHERE share_token IS NULL
  AND access_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_merged_reports_share_token_unique
  ON public.merged_reports (share_token)
  WHERE share_token IS NOT NULL;
