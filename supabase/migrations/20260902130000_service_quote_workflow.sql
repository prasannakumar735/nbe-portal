-- Service quote workflow columns on the shared `quotes` table.
-- Stages: draft_review → on_hold → approved → completed
-- Terminal: rejected, void

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS workflow_status       TEXT        NOT NULL DEFAULT 'draft_review',
  ADD COLUMN IF NOT EXISTS approval_po_reference TEXT        NULL,
  ADD COLUMN IF NOT EXISTS approval_message      TEXT        NULL,
  ADD COLUMN IF NOT EXISTS approved_at           TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS approved_by           UUID        NULL REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at          TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS completed_by          UUID        NULL REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_user_id      UUID        NULL REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_status        TEXT        NULL,
  ADD COLUMN IF NOT EXISTS invoice_status_at     TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS workflow_history      JSONB       NOT NULL DEFAULT '[]'::jsonb;
