-- Track Microsoft Graph workflow emails for maintenance reports (idempotent notifications).

ALTER TABLE public.maintenance_reports
  ADD COLUMN IF NOT EXISTS manager_workflow_email_sent_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS technician_approval_email_sent_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.maintenance_reports.manager_workflow_email_sent_at IS
  'When manager/admin submission notifications were sent (Graph workflow).';
COMMENT ON COLUMN public.maintenance_reports.technician_approval_email_sent_at IS
  'When the technician was notified that the report was approved (Graph workflow).';
