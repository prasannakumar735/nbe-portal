-- Maintenance inspection module tables

CREATE TABLE IF NOT EXISTS maintenance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_name TEXT NOT NULL,
  submission_date DATE NOT NULL,
  source_app TEXT NOT NULL DEFAULT 'Portal',
  customer_id UUID NULL,
  other_location TEXT NULL,
  address TEXT NOT NULL,
  inspection_date DATE NOT NULL,
  inspection_start TIME NOT NULL,
  inspection_end TIME NOT NULL,
  total_doors INTEGER NOT NULL CHECK (total_doors > 0),
  notes TEXT NULL,
  signature_url TEXT NULL,
  pdf_url TEXT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted')) DEFAULT 'draft',
  submitted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_reports_status ON maintenance_reports(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_reports_submission_date ON maintenance_reports(submission_date DESC);

CREATE TABLE IF NOT EXISTS maintenance_doors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES maintenance_reports(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  door_number TEXT NOT NULL,
  door_type TEXT NOT NULL,
  door_cycles NUMERIC(12, 2) NOT NULL DEFAULT 0,
  view_window_visibility NUMERIC(5, 2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_doors_report_id ON maintenance_doors(report_id);

CREATE TABLE IF NOT EXISTS maintenance_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  door_id UUID NOT NULL REFERENCES maintenance_doors(id) ON DELETE CASCADE,
  item_code TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('good', 'caution', 'fault', 'na')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_checklist_door_item ON maintenance_checklist(door_id, item_code);

CREATE TABLE IF NOT EXISTS maintenance_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  door_id UUID NOT NULL REFERENCES maintenance_doors(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_photos_door_id ON maintenance_photos(door_id);
