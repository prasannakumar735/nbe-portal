-- PVC Flex System inventory pricing tables
-- Three separate product categories: Bulk Roll, Headrail Only, Rivet Plates

CREATE TABLE IF NOT EXISTS pvc_bulk_roll_pricing (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  grade         text          NOT NULL,   -- 'Coolroom' | 'Freezer'
  strip_width   integer       NOT NULL,   -- mm: 100 | 150 | 200 | 300
  thickness     integer       NOT NULL,   -- mm: 2 | 3
  actual_cost   numeric(10,4) NOT NULL DEFAULT 0,
  sales_fee     numeric(10,2) NOT NULL DEFAULT 0,
  company_fee   numeric(10,2) NOT NULL DEFAULT 0,
  shipping_fee  numeric(10,2) NOT NULL DEFAULT 0,
  total_cost_default numeric(10,2) NOT NULL,  -- sell price at 100% markup
  created_at    timestamptz   DEFAULT now(),
  updated_at    timestamptz   DEFAULT now(),
  UNIQUE(grade, strip_width, thickness)
);

CREATE TABLE IF NOT EXISTS pvc_headrail_pricing (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  material      text          NOT NULL,   -- 'Galvanised' | 'Stainless Steel'
  length        text          NOT NULL,   -- '1M' | '2M' | '3M'
  actual_cost   numeric(10,4) NOT NULL DEFAULT 0,
  sales_fee     numeric(10,2) NOT NULL DEFAULT 0,
  company_fee   numeric(10,2) NOT NULL DEFAULT 0,
  shipping_fee  numeric(10,2) NOT NULL DEFAULT 0,
  total_cost_default numeric(10,2) NOT NULL,
  created_at    timestamptz   DEFAULT now(),
  updated_at    timestamptz   DEFAULT now(),
  UNIQUE(material, length)
);

CREATE TABLE IF NOT EXISTS pvc_rivet_plate_pricing (
  id            uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  material      text          NOT NULL,   -- 'Stainless Steel' | 'Galvanised'
  size          text          NOT NULL,   -- '150mm' | '200mm' | '300mm'
  actual_cost   numeric(10,4) NOT NULL DEFAULT 0,
  sales_fee     numeric(10,2) NOT NULL DEFAULT 0,
  company_fee   numeric(10,2) NOT NULL DEFAULT 0,
  shipping_fee  numeric(10,2) NOT NULL DEFAULT 0,
  total_cost_default numeric(10,2) NOT NULL,
  created_at    timestamptz   DEFAULT now(),
  updated_at    timestamptz   DEFAULT now(),
  UNIQUE(material, size)
);

-- Seed: Bulk Roll (each roll = 50m; fees assumed $25 sales + $25 company + $0 shipping)
INSERT INTO pvc_bulk_roll_pricing (grade, strip_width, thickness, actual_cost, sales_fee, company_fee, shipping_fee, total_cost_default) VALUES
  ('Coolroom', 100, 2,  65.00,   25, 25, 0, 180.00),
  ('Coolroom', 150, 2,  84.57,   25, 25, 0, 219.14),
  ('Coolroom', 200, 2, 112.50,   25, 25, 0, 275.00),
  ('Coolroom', 200, 3, 135.00,   25, 25, 0, 320.00),
  ('Coolroom', 300, 3, 245.00,   25, 25, 0, 540.00),
  ('Freezer',  100, 2,  57.50,   25, 25, 0, 165.00),
  ('Freezer',  150, 2,  86.00,   25, 25, 0, 222.00),
  ('Freezer',  200, 2, 105.00,   25, 25, 0, 260.00),
  ('Freezer',  200, 3, 138.29,   25, 25, 0, 326.58),
  ('Freezer',  300, 3, 255.00,   25, 25, 0, 560.00)
ON CONFLICT (grade, strip_width, thickness) DO NOTHING;

-- Seed: Headrail Only
INSERT INTO pvc_headrail_pricing (material, length, actual_cost, sales_fee, company_fee, shipping_fee, total_cost_default) VALUES
  ('Galvanised',      '3M', 48.24, 25, 25,  0, 150.00),
  ('Galvanised',      '2M',  0.00,  0,  0,  0, 100.00),
  ('Galvanised',      '1M',  0.00,  0,  0,  0,  50.00),
  ('Stainless Steel', '3M', 22.28, 25, 25, 30, 125.28),
  ('Stainless Steel', '2M', 11.14, 18, 20, 30,  90.64),
  ('Stainless Steel', '1M',  7.43, 10, 10, 20,  55.09)
ON CONFLICT (material, length) DO NOTHING;

-- Seed: Rivet Plates
INSERT INTO pvc_rivet_plate_pricing (material, size, actual_cost, sales_fee, company_fee, shipping_fee, total_cost_default) VALUES
  ('Stainless Steel', '150mm', 1.46, 1, 1, 2,  7.00),
  ('Stainless Steel', '200mm', 1.78, 1, 1, 2, 12.00),
  ('Stainless Steel', '300mm', 2.60, 1, 1, 2, 18.00),
  ('Galvanised',      '150mm', 0.00, 0, 0, 0,  4.00),
  ('Galvanised',      '200mm', 0.00, 0, 0, 0,  8.00),
  ('Galvanised',      '300mm', 0.00, 0, 0, 0, 12.00)
ON CONFLICT (material, size) DO NOTHING;

-- Enable RLS
ALTER TABLE pvc_bulk_roll_pricing    ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvc_headrail_pricing     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pvc_rivet_plate_pricing  ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all pricing
CREATE POLICY "Authenticated read pvc_bulk_roll_pricing"
  ON pvc_bulk_roll_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read pvc_headrail_pricing"
  ON pvc_headrail_pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read pvc_rivet_plate_pricing"
  ON pvc_rivet_plate_pricing FOR SELECT TO authenticated USING (true);

-- Only service_role can write (API routes use service_role key)
CREATE POLICY "Service write pvc_bulk_roll_pricing"
  ON pvc_bulk_roll_pricing FOR ALL TO service_role USING (true);
CREATE POLICY "Service write pvc_headrail_pricing"
  ON pvc_headrail_pricing FOR ALL TO service_role USING (true);
CREATE POLICY "Service write pvc_rivet_plate_pricing"
  ON pvc_rivet_plate_pricing FOR ALL TO service_role USING (true);
