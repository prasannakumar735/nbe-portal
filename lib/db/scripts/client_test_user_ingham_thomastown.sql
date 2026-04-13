-- =============================================================================
-- Test client login for merged report viewer (/report/view/..., /client/login)
-- Run in Supabase SQL Editor (postgres role bypasses RLS).
--
-- 1) Run the LOOKUP section first. Copy the correct client UUID.
-- 2) Create the auth user in Dashboard: Authentication → Users → Add user
--    (or use the optional auth.users block at the bottom if your project allows it).
-- 3) Run the PROFILE section with your chosen email and the client UUID.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- OPTIONAL: see actual column names (schemas differ between environments)
-- ---------------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'clients'
ORDER BY ordinal_position;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'client_locations'
ORDER BY ordinal_position;

-- ---------------------------------------------------------------------------
-- LOOKUP: clients table with columns (id, name, created_at) — copy **client_id**
-- ---------------------------------------------------------------------------
SELECT c.id AS client_id,
       c.name AS client_name
FROM public.clients c
WHERE c.name ILIKE '%ingham%'
ORDER BY c.name;

-- By site / suburb (if you use client_locations; columns vary — JSON search)
SELECT c.id AS client_id,
       c.name AS client_name,
       cl.id AS location_id,
       to_jsonb(cl) AS location_row
FROM public.client_locations cl
JOIN public.clients c ON c.id = cl.client_id
WHERE to_jsonb(cl)::text ILIKE '%thomastown%'
   OR c.name ILIKE '%ingham%'
ORDER BY c.name, cl.id;

-- Fallback if `name` is null or schema differs: search whole row
-- SELECT c.id AS client_id, to_jsonb(c) AS client_row
-- FROM public.clients c
-- WHERE to_jsonb(c)::text ILIKE '%ingham%';

-- Or: SELECT * FROM public.clients ORDER BY name;

-- IMPORTANT: Use column **client_id** from these results (from public.clients).
-- Do NOT use **location_id** (client_locations.id) — it will fail FK profiles_client_id_fkey.

-- If you see ERROR 23503 on profiles.client_id: confirm your UUID exists in clients:
-- SELECT id FROM public.clients WHERE id = 'YOUR-UUID-HERE'::uuid;
-- Or see whether you pasted a location id:
-- SELECT cl.client_id FROM public.client_locations cl WHERE cl.id = 'YOUR-UUID-HERE'::uuid;

-- Paste the chosen UUID here for the next block:
-- \set client_id '00000000-0000-0000-0000-000000000000'  -- psql only; in SQL Editor replace literals below

-- ---------------------------------------------------------------------------
-- PROFILE: link auth user to client (role = client)
-- Replace placeholders:
--   YOUR_CLIENT_UUID  → from lookup above (e.g. Ingham)
--   YOUR_TEST_EMAIL   → same email as in Authentication
--
-- If your verify query returns NO ROWS, the user exists in auth.users but has
-- NO public.profiles row — /client/login will always reject. You must INSERT
-- (the block below), not only UPDATE.
-- ---------------------------------------------------------------------------
INSERT INTO public.profiles (id, full_name, role, client_id)
SELECT u.id,
       'Ingham Thomastown (test client)',
       'client',
       'YOUR_CLIENT_UUID'::uuid
FROM auth.users u
WHERE u.email = 'YOUR_TEST_EMAIL'
LIMIT 1
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  client_id = EXCLUDED.client_id,
  full_name = EXCLUDED.full_name;

-- Optional: only if you already had a profile row and just need column fixes:
-- UPDATE public.profiles SET role = 'client', client_id = 'YOUR_CLIENT_UUID'::uuid, ...
-- WHERE id = (SELECT id FROM auth.users WHERE email = 'YOUR_TEST_EMAIL' LIMIT 1);

-- Verify
SELECT p.id,
       u.email,
       p.role,
       p.client_id,
       c.name AS client_name
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
LEFT JOIN public.clients c ON c.id = p.client_id
WHERE u.email = 'YOUR_TEST_EMAIL';

-- ---------------------------------------------------------------------------
-- Login
-- ---------------------------------------------------------------------------
-- Open: /client/login
-- Email:    YOUR_TEST_EMAIL
-- Password: (the one you set in Dashboard)
-- Then open a merged report link for that same client_id, e.g. /report/view/<token>

-- ---------------------------------------------------------------------------
-- OPTIONAL: create user entirely in SQL (Supabase-hosted; schema may vary)
-- Prefer Dashboard → Authentication → Users → Add user → Confirm email.
-- If you use SQL, ensure `email_confirmed_at` is set so login works:
-- ---------------------------------------------------------------------------
/*
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
VALUES (
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'YOUR_TEST_EMAIL',
  crypt('YOUR_TEMP_PASSWORD', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

-- Link identity for email provider (required on many Supabase versions)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT gen_random_uuid(),
       id,
       format('{"sub":"%s","email":"%s"}', id::text, email)::jsonb,
       'email',
       id::text,
       now(),
       now(),
       now()
FROM auth.users
WHERE email = 'YOUR_TEST_EMAIL';

-- Then run the INSERT/UPDATE public.profiles block above with YOUR_CLIENT_UUID.
*/
