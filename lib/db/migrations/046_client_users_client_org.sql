-- Link portal client_users to public.clients — must match profiles.client_id for merged-report access.

ALTER TABLE public.client_users
  ADD COLUMN IF NOT EXISTS client_id UUID NULL REFERENCES public.clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_client_users_client_id ON public.client_users (client_id) WHERE client_id IS NOT NULL;

COMMENT ON COLUMN public.client_users.client_id IS 'Same as profiles.client_id — organisation for merged report /report/view access';

-- Keep roster in sync where profiles already had client_id (e.g. manual fixes)
UPDATE public.client_users cu
SET client_id = p.client_id
FROM public.profiles p
WHERE p.id = cu.id
  AND p.role = 'client'
  AND p.client_id IS NOT NULL
  AND (cu.client_id IS NULL OR cu.client_id IS DISTINCT FROM p.client_id);
