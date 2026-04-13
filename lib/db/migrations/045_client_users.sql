-- Client portal roster: display name, company, login email, bcrypt hash (canonical for audit),
-- synced with Supabase Auth + profiles (role = client) for existing /client/login flow.

CREATE TABLE IF NOT EXISTS public.client_users (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_users_email_lower ON public.client_users (lower(email));

COMMENT ON TABLE public.client_users IS 'External client logins; password_hash is bcrypt; keep in sync with auth.users password via app on create/reset';
COMMENT ON COLUMN public.client_users.id IS 'Matches auth.users.id';

ALTER TABLE public.client_users ENABLE ROW LEVEL SECURITY;

-- Intentionally no policies for authenticated: access only via service role in server routes.
