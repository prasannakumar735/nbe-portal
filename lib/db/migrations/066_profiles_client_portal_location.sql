-- Optional single-site scope for client portal (dashboard, reports, gallery, PDF links).
-- When set, must reference client_locations.id where client_locations.client_id = profiles.client_id.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS client_portal_location_id UUID NULL REFERENCES public.client_locations (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.client_portal_location_id IS
  'When role = client: limit portal lists/PDFs/gallery to this site only; NULL = all locations for profiles.client_id';

CREATE INDEX IF NOT EXISTS idx_profiles_client_portal_location_id
  ON public.profiles (client_portal_location_id)
  WHERE client_portal_location_id IS NOT NULL;
