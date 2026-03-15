-- Migration: Door registry + door inspection history linked to client locations
-- Note: Reuses existing clients, client_locations, maintenance_reports, maintenance_doors, maintenance_photos tables.

-- 1) Reusable doors table scoped to client locations
CREATE TABLE IF NOT EXISTS public.doors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_location_id UUID NOT NULL REFERENCES public.client_locations(id) ON DELETE CASCADE,
  door_label TEXT NOT NULL,
  door_type TEXT NULL,
  install_date DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_location_id, door_label)
);

CREATE INDEX IF NOT EXISTS idx_doors_client_location_id ON public.doors(client_location_id);
CREATE INDEX IF NOT EXISTS idx_doors_door_label ON public.doors(door_label);

-- 2) Add location linkage to maintenance reports
ALTER TABLE IF EXISTS public.maintenance_reports
  ADD COLUMN IF NOT EXISTS client_location_id UUID NULL REFERENCES public.client_locations(id);

CREATE INDEX IF NOT EXISTS idx_maintenance_reports_client_location_id ON public.maintenance_reports(client_location_id);

-- 3) Link per-report door rows back to reusable doors table
ALTER TABLE IF EXISTS public.maintenance_doors
  ADD COLUMN IF NOT EXISTS door_id UUID NULL REFERENCES public.doors(id);

CREATE INDEX IF NOT EXISTS idx_maintenance_doors_door_id ON public.maintenance_doors(door_id);

-- 4) Door inspection history table
CREATE TABLE IF NOT EXISTS public.door_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.maintenance_reports(id) ON DELETE CASCADE,
  door_id UUID NOT NULL REFERENCES public.doors(id) ON DELETE CASCADE,
  checklist_results JSONB NOT NULL DEFAULT '{}'::jsonb,
  technician_notes TEXT NULL,
  ai_summary TEXT NULL,
  photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_door_inspections_door_id ON public.door_inspections(door_id);
CREATE INDEX IF NOT EXISTS idx_door_inspections_report_id ON public.door_inspections(report_id);
CREATE INDEX IF NOT EXISTS idx_door_inspections_created_at ON public.door_inspections(created_at DESC);

-- 5) Backfill maintenance_doors.door_id for existing report door rows
-- Uses report location + door label match to avoid cross-location collisions.
UPDATE public.maintenance_doors md
SET door_id = d.id
FROM public.maintenance_reports mr
JOIN public.doors d
  ON d.client_location_id = mr.client_location_id
 AND lower(trim(d.door_label)) = lower(trim(md.door_number))
WHERE md.report_id = mr.id
  AND md.door_id IS NULL;
