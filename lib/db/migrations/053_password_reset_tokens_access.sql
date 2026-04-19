-- Ensure password_reset_tokens is writable by the API (service role / PostgREST).
-- If 052 was applied with RLS ON and no policies, inserts can fail depending on role setup.

ALTER TABLE IF EXISTS public.password_reset_tokens DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.password_reset_tokens TO service_role;
GRANT ALL ON TABLE public.password_reset_tokens TO postgres;
