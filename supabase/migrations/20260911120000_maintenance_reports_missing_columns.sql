-- Add columns that the maintenance draft/submit API writes unconditionally
-- but were never tracked in migrations.  All use IF NOT EXISTS so they are
-- safe to run on a DB that already has them.

ALTER TABLE maintenance_reports
  ADD COLUMN IF NOT EXISTS report_schema_version     integer        DEFAULT 2,
  ADD COLUMN IF NOT EXISTS client_sub_project_id     uuid           REFERENCES client_sub_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS repair_summary_text       text,
  ADD COLUMN IF NOT EXISTS repair_summary_overrides  jsonb,
  ADD COLUMN IF NOT EXISTS edited_by                 uuid,
  ADD COLUMN IF NOT EXISTS edited_at                 timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_at              timestamptz,
  ADD COLUMN IF NOT EXISTS technician_email          text,
  ADD COLUMN IF NOT EXISTS technician_contact        text,
  ADD COLUMN IF NOT EXISTS submitter_email           text,
  ADD COLUMN IF NOT EXISTS submitter_contact         text,
  ADD COLUMN IF NOT EXISTS health_score_override     integer        CHECK (health_score_override >= 0 AND health_score_override <= 100),
  ADD COLUMN IF NOT EXISTS health_score_color        text           CHECK (health_score_color IN ('green', 'amber', 'red'));

ALTER TABLE maintenance_doors
  ADD COLUMN IF NOT EXISTS technician_door_details   text,
  ADD COLUMN IF NOT EXISTS door_master_description   text,
  ADD COLUMN IF NOT EXISTS door_master_type_alt      text,
  ADD COLUMN IF NOT EXISTS door_master_cw            text,
  ADD COLUMN IF NOT EXISTS door_master_ch            text;

-- door_inspections.photos was added to the insert in May 2026
ALTER TABLE door_inspections
  ADD COLUMN IF NOT EXISTS photos  jsonb  DEFAULT '[]'::jsonb;
