-- Internal client + site for office QR clock / admin (run in Supabase SQL editor).
-- Idempotent: skips if "NBE Office" client or "Campbellfield Office" location already exists.
--
-- Simple two-step alternative (copy client id from first query result into second):
--   INSERT INTO public.clients (id, name) VALUES (gen_random_uuid(), 'NBE Office') RETURNING id;
--   INSERT INTO public.client_locations (id, client_id, location_name, "Company_address", suburb)
--   VALUES (gen_random_uuid(), '<client-uuid>', 'Campbellfield Office', 'Campbellfield VIC 3061', 'Campbellfield');

INSERT INTO public.clients (id, name)
SELECT gen_random_uuid(), 'NBE Office'
WHERE NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.name = 'NBE Office');

INSERT INTO public.client_locations (id, client_id, location_name, "Company_address", suburb)
SELECT
  gen_random_uuid(),
  c.id,
  'Campbellfield Office',
  'Campbellfield VIC 3061',
  'Campbellfield'
FROM public.clients c
WHERE c.name = 'NBE Office'
  AND NOT EXISTS (
    SELECT 1
    FROM public.client_locations l
    WHERE l.client_id = c.id
      AND l.location_name = 'Campbellfield Office'
  );
