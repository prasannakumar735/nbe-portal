-- Default FAB (Level 2) task for technicians when they omit workTypeLevel2Id on office sign-out
-- or when the auto-close-forgotten job runs after 17:00 Melbourne (same calendar day as clock-in).
--
-- Fallback order in app code: explicit body workTypeLevel2Id → this column → env
-- OFFICE_CLOCK_TECHNICIAN_DEFAULT_WORK_TYPE_LEVEL2_ID (see lib/officeClock/envSiteFallback.ts).
--
-- After deploy, set to a valid work_type_level2.id whose parent work_type_level1.code is FAB (any case), e.g.:
--   UPDATE public.office_clock_sites
--   SET technician_default_work_type_level2_id = '<uuid>'
--   WHERE slug = 'hq';

ALTER TABLE public.office_clock_sites
  ADD COLUMN IF NOT EXISTS technician_default_work_type_level2_id UUID NULL
    REFERENCES public.work_type_level2 (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.office_clock_sites.technician_default_work_type_level2_id IS
  'Technician office-clock default FAB L2 when UI/body omits workTypeLevel2Id; required for consistent reporting if no env override.';
