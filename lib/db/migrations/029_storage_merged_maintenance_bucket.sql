-- 029 — Private Storage bucket for merged maintenance PDFs
--
-- Purpose: Store generated PDF bytes; objects are not public URLs — apps use signed URLs or
--   service-role reads after verifying `merged_reports` access (staff or client token flow).
-- RLS: Storage policies (if any) are managed in Supabase dashboard or follow-up migrations.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'merged-maintenance-reports',
  'merged-maintenance-reports',
  false,
  52428800,
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
