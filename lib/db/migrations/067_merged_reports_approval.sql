-- 067_merged_reports_approval.sql
-- Adds approval workflow columns to merged_reports.
-- Safe to run before or after code deploy:
--   - New rows default to approved=false (pending).
--   - All existing rows are backfilled to approved=true so no currently-shared
--     client links are broken.
--   - The application gate treats NULL as approved (null-safe), so existing rows
--     are accessible even if this migration runs after the code ships.

ALTER TABLE merged_reports
  ADD COLUMN IF NOT EXISTS status       text        NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at  timestamptz;

-- Backfill: all existing (non-deleted) merged reports are already live and
-- have been shared with clients, so mark them approved immediately.
UPDATE merged_reports
  SET status      = 'approved',
      approved    = true,
      approved_at = COALESCE(created_at, NOW())
  WHERE deleted_at IS NULL
    AND approved = false;
