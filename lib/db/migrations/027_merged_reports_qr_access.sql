-- 027 — QR / secure client access for merged maintenance reports
--
-- Purpose: Add unguessable `access_token` and storage paths for client-facing PDF links.
-- Security: Row-level policies for who can read/update `merged_reports` live in other migrations;
--   this file only extends the schema. API routes validate `access_token` for anonymous viewers.

ALTER TABLE IF EXISTS public.merged_reports
  ADD COLUMN IF NOT EXISTS access_token UUID UNIQUE,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT NULL;

COMMENT ON COLUMN public.merged_reports.access_token IS 'Unguessable token for /client/report/{token}; not internal row id';
COMMENT ON COLUMN public.merged_reports.pdf_url IS 'Full URL to client viewer page (same as QR target)';
COMMENT ON COLUMN public.merged_reports.pdf_storage_path IS 'Path within merged-maintenance-reports bucket';
COMMENT ON COLUMN public.merged_reports.access_expires_at IS 'Optional expiry for client link; null = no expiry';

CREATE INDEX IF NOT EXISTS idx_merged_reports_access_token
  ON public.merged_reports (access_token)
  WHERE access_token IS NOT NULL;
