-- Admin UI + maintenance flows expect a dedicated site/location display name.
-- Some production DBs predate this column; add it idempotently.
ALTER TABLE public.client_locations
  ADD COLUMN IF NOT EXISTS location_name text;

COMMENT ON COLUMN public.client_locations.location_name IS 'Human-readable site/location label (admin Clients page, maintenance location pickers).';
