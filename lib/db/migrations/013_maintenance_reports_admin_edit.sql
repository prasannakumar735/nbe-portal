-- Admin edit tracking and reviewing status for maintenance reports

ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS edited_by UUID NULL,
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ NULL;

-- Allow status 'reviewing' in addition to 'draft' and 'submitted'
ALTER TABLE maintenance_reports
  DROP CONSTRAINT IF EXISTS maintenance_reports_status_check;

ALTER TABLE maintenance_reports
  ADD CONSTRAINT maintenance_reports_status_check
  CHECK (status IN ('draft', 'submitted', 'reviewing'));
