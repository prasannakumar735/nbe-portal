-- Door registry: optional master fields for maintenance UI / PDF snapshot
ALTER TABLE public.doors
  ADD COLUMN IF NOT EXISTS door_description TEXT NULL,
  ADD COLUMN IF NOT EXISTS door_type_alt TEXT NULL,
  ADD COLUMN IF NOT EXISTS cw TEXT NULL,
  ADD COLUMN IF NOT EXISTS ch TEXT NULL;

-- New reports only: >= 2 enables door master + technician door details in UI/PDF
ALTER TABLE public.maintenance_reports
  ADD COLUMN IF NOT EXISTS report_schema_version INTEGER NOT NULL DEFAULT 1;

-- Snapshot at save time (historical PDFs stable if registry changes later)
ALTER TABLE public.maintenance_doors
  ADD COLUMN IF NOT EXISTS door_master_description TEXT NULL,
  ADD COLUMN IF NOT EXISTS door_master_type_alt TEXT NULL,
  ADD COLUMN IF NOT EXISTS door_master_cw TEXT NULL,
  ADD COLUMN IF NOT EXISTS door_master_ch TEXT NULL,
  ADD COLUMN IF NOT EXISTS technician_door_details TEXT NULL;
