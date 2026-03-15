-- Allow managers to set maintenance reports to 'approved' and include full lifecycle statuses

ALTER TABLE maintenance_reports
  DROP CONSTRAINT IF EXISTS maintenance_reports_status_check;

ALTER TABLE maintenance_reports
  ADD CONSTRAINT maintenance_reports_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'completed'));
