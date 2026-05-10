-- Sub-projects / sub-clients under a main client (FK to clients).
-- Safe to run once. Re-run seeds: ON CONFLICT DO NOTHING skips duplicates.

CREATE TABLE IF NOT EXISTS public.client_sub_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_client_sub_projects_client_name UNIQUE (client_id, name)
);

CREATE INDEX IF NOT EXISTS idx_client_sub_projects_client_id ON public.client_sub_projects (client_id);

ALTER TABLE public.employee_timesheet_entries
  ADD COLUMN IF NOT EXISTS client_sub_project_id UUID NULL REFERENCES public.client_sub_projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_employee_timesheet_entries_sub_project ON public.employee_timesheet_entries (client_sub_project_id);

ALTER TABLE public.maintenance_reports
  ADD COLUMN IF NOT EXISTS client_sub_project_id UUID NULL REFERENCES public.client_sub_projects (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_reports_client_sub_project ON public.maintenance_reports (client_sub_project_id);

ALTER TABLE public.client_sub_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_client_sub_projects" ON public.client_sub_projects;
CREATE POLICY "authenticated_select_client_sub_projects"
  ON public.client_sub_projects FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE public.client_sub_projects IS 'Optional sub-project/site labels under a client; required in UI when rows exist for that client.';

-- Seed: parent_norm = lower(trim(clients.name)). Aligns with portal clients bulk INSERT (unique name).
-- Parents not present in `clients` are skipped (no error).
INSERT INTO public.client_sub_projects (client_id, name, sort_order)
SELECT c.id, s.sub_name, s.sort_ord
FROM (
  VALUES
    -- Austral
    ('austral'::text, 'Austral Insulation'::text, 1),
    ('austral', 'Austral Lion Nathan', 2),
    ('austral', 'Austral Little Creatures', 3),
    ('austral', 'Austral Menora Foods', 4),
    ('austral', 'Austral VIP Packaging', 5),
    -- AWGD (client row is spelled AWGD in DB; sub labels keep ANGD-* from master sheet)
    ('awgd', 'ANGD - Ashi', 1),
    ('awgd', 'ANGD - Billson', 2),
    ('awgd', 'ANGD - Braken', 3),
    ('awgd', 'ANGD - Butko', 4),
    ('awgd', 'ANGD - Carla Holt Harvey', 5),
    ('awgd', 'ANGD - Chobani Holt Harvey', 6),
    ('awgd', 'ANGD - Joss H20', 7),
    ('awgd', 'ANGD - Joss H21', 8),
    ('awgd', 'ANGD - Joss H22', 9),
    ('awgd', 'ANGD - Joss H23', 10),
    ('awgd', 'ANGD - Joss H24', 11),
    ('awgd', 'ANGD - Joss H25', 12),
    ('awgd', 'ANGD - Joss H26', 13),
    ('awgd', 'ANGD - Joss H27', 14),
    ('awgd', 'ANGD - Joss H28', 15),
    ('awgd', 'ANGD - Joss H29', 16),
    ('awgd', 'ANGD - Riverina Oil', 17),
    ('awgd', 'ANGD - V2', 18),
    ('awgd', 'ANGD - V3', 19),
    ('awgd', 'ANGD - Alpine MDF', 20),
    -- Assa Abloy
    ('assa abloy', 'Assa Abloy - Montague Rd', 1),
    -- Della Rosa Fresh Foods
    ('della rosa fresh foods', 'Della Rosa Porky', 1),
    ('della rosa fresh foods', 'Della Rosa', 2),
    -- Besam WA
    ('besam wa', 'Besam WA - Assa Abloy', 1),
    -- Biodynamic
    ('biodynamic', 'Bio Dynamic (Fencing)', 1),
    -- Blackmores
    ('blackmores', 'Blackmores - Catalent', 1),
    -- Dans Plants (sheet ref. Dans Pasta PJO025)
    ('dans plants', 'Dans Pasta (PJO025)', 1),
    -- Designer Cool Rooms
    ('designer cool rooms', 'Designer Coolrooms - KealMac', 1),
    ('designer cool rooms', 'Designer Coolrooms KADAC', 2),
    ('designer cool rooms', 'Designer Coolrooms MOTTA', 3),
    ('designer cool rooms', 'Designer Coolrooms Red Gem', 4),
    ('designer cool rooms', 'Designer Cool Rooms', 5),
    ('designer cool rooms', 'Designer Coolroom', 6),
    ('designer cool rooms', 'Designer LINFOX', 7),
    ('designer cool rooms', 'Designer VLUSHW', 8),
    -- DHG
    ('dhg', 'DHG New Building', 1),
    -- Di Rossi
    ('di rossi', 'Di Rossi Foods', 1),
    ('di rossi', 'Di Rossi Pistol Dairy', 2),
    -- Diamond Valley Pork
    ('diamond valley pork', 'Diamond Valley Pork (NBL)', 1),
    -- DMG
    ('dmg', 'DMG (Pacific) Workshop', 1),
    ('dmg', 'DMG Angelica', 2),
    ('dmg', 'DMG Parmalat', 3),
    ('dmg', 'DMG Industries (Dorothy)', 4),
    ('dmg', 'DMG Yarraville', 5),
    -- Farm Pride Foods
    ('farm pride foods', 'Farm Pride Foods (Battery Rd)', 1),
    ('farm pride foods', 'Farm Pride Foods (Custom Rd)', 2),
    -- FBJ
    ('fbj', 'FBJ Cadbury', 1),
    ('fbj', 'FBJ Meadow Lea', 2),
    -- Flavour Makers
    ('flavour makers', 'Flavour Makers', 1),
    ('flavour makers', 'Flavour Makers (Dandenong)', 2),
    -- Floridia Cheese
    ('floridia cheese', 'Floridia Cheese (George Rye)', 1),
    -- Fort Knox
    ('fort knox', 'Fort Knox - Alphington (Eltham)', 1),
    ('fort knox', 'Fort Knox - Vermont (Dandenong)', 2),
    ('fort knox', 'Fort Knox - Vermont (Bayswater)', 3),
    ('fort knox', 'Fort Knox - Keysborough', 4),
    -- Fresh Berry Co
    ('fresh berry co', 'Fresh Berry Co. (Melbourne)', 1),
    -- GCP
    ('gcp', 'GCP Garden City Plates', 1),
    ('gcp', 'GCP Mainland', 2),
    -- Honda
    ('honda', 'Honda - Tullamarine', 1),
    -- Joy Foods (bulk clients spelling)
    ('joy foods', 'Joy Foods (DFO)', 1),
    ('joy foods', 'Joy Foods (Dry Foods)', 2),
    -- MG
    ('mg', 'MG Allans', 1),
    ('mg', 'MG Leongatha', 2),
    -- Monk Brothers
    ('monk brothers', 'Monk Mixers', 1),
    ('monk brothers', 'Monk Netsuite', 2),
    -- Murray Goulburn
    ('murray goulburn', 'Murray Goulburn (Dandenong)', 1),
    -- Nicway
    ('nicway', 'Nicway RRC', 1),
    -- Poultry Palace
    ('poultry palace', 'Poultry & More Cold Storage', 1),
    -- Saputo
    ('saputo', 'Saputo (Bogan Tung AN)', 1),
    ('saputo', 'Saputo (Skim Plant/AUC)', 2),
    ('saputo', 'Saputo (Burnie) Feeding Bay', 3),
    ('saputo', 'Saputo (WCB) Cheese Output', 4),
    -- Scorpio Meats
    ('scorpio meats', 'Scorpio Coldstores', 1),
    -- SSP Fine Foods
    ('ssp fine foods', 'SSP', 1),
    -- Tasman Meats Berwick (closest match to sheet “Tasman Meals Produce”)
    ('tasman meats berwick', 'Tasman Meals Brooklyn (JBS)', 1),
    -- VIP Plastics
    ('vip plastics', 'VIP Foot', 1),
    -- WCB
    ('wcb', 'WCB - Burnie Cold Room', 1),
    ('wcb', 'WCB - Cheese Processing area', 2),
    ('wcb', 'WCB - Daily Farmers', 3),
    ('wcb', 'WCB - GDS', 4),
    ('wcb', 'WCB - Hindi', 5),
    ('wcb', 'WCB - New Curtain Bottle Shed', 6),
    ('wcb', 'WCB - Pallet Shed', 7),
    ('wcb', 'WCB - Replacement Doors', 8),
    ('wcb', 'WCB - Slangold', 9),
    ('wcb', 'WCB - Sungold', 10),
    ('wcb', 'WCB (Tyson)', 11),
    ('wcb', 'WCB / Harrington Daily Chees', 12),
    ('wcb', 'WCB ADV', 13),
    ('wcb', 'WCB Butcher', 14),
    ('wcb', 'WCB GDS', 15),
    ('wcb', 'WCB Harrington [ASTREA Park]', 16),
    ('wcb', 'WCB Harrington [Carbon Filter]', 17),
    ('wcb', 'WCB Harrington [Deodor Deck]', 18),
    ('wcb', 'WCB Harrington Rangfield', 19),
    ('wcb', 'WCB Lactos', 20),
    ('wcb', 'WCB Loading Loading Dock', 21),
    ('wcb', 'WCB Millst', 22),
    ('wcb', 'WCB Replacement Carbon', 23),
    ('wcb', 'WCB Springvale', 24),
    ('wcb', 'WCB Warrnambool', 25),
    -- WCBF
    ('wcbf', 'WCBF - Bottle Shed (GDS 9)', 1),
    ('wcbf', 'WCBF - Butter Dry Goods Store', 2),
    ('wcbf', 'WCBF - Cheese Airlock', 3),
    ('wcbf', 'WCBF - Harrington [Cheese D]', 4),
    ('wcbf', 'WCBF - Harrington Weigh Floor', 5),
    ('wcbf', 'WCBF - Mezzanine Pavilion', 6),
    ('wcbf', 'WCBF - Receival Shed', 7),
    ('wcbf', 'WCBF - Saputo Dry Goods', 8),
    ('wcbf', 'WCBF GDS [Spares]', 9),
    ('wcbf', 'WCBF Saputo', 10),
    ('wcbf', 'WCBF Saputo Hallamford', 11)
) AS s(parent_norm, sub_name, sort_ord)
JOIN public.clients c ON lower(trim(c.name)) = s.parent_norm
ON CONFLICT ON CONSTRAINT uq_client_sub_projects_client_name DO NOTHING;
