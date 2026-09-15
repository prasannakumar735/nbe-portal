-- Rapid Door option map: all dropdown options with PDF descriptions
-- Categories: indicatorLamp, safety, pushButton, radar, remoteControl,
--             inductLoop, swipe, doorControl, frame, curtain, colour,
--             motorKw, motorSide, controlBoxSide

CREATE TABLE IF NOT EXISTS rapid_door_option_map (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  category    text    NOT NULL,
  code        text    NOT NULL,
  label       text    NOT NULL,
  description text    NOT NULL DEFAULT '',
  hex_colour  text,
  sort_order  int     NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category, code)
);

ALTER TABLE rapid_door_option_map ENABLE ROW LEVEL SECURITY;

-- Portal staff can read all active options
CREATE POLICY "portal staff read options"
  ON rapid_door_option_map FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only service role can insert/update (managed via admin or migrations)
CREATE POLICY "service role manage options"
  ON rapid_door_option_map FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- ── Seed data ────────────────────────────────────────────────────────────────

INSERT INTO rapid_door_option_map (category, code, label, description, hex_colour, sort_order) VALUES
  -- Indicator Lamp
  ('indicatorLamp', 'AMB', 'AMB', '(Amber Strobe Light)', null, 10),
  ('indicatorLamp', 'LED', 'LED', '(LED Traffic Light)',  null, 20),
  ('indicatorLamp', 'RYG', 'RYG', '(RYG Signal Tower)',  null, 30),

  -- Safety Sensor
  ('safety', 'PEC', 'PEC', '(Dual-Photocell)',        null, 10),
  ('safety', 'SLC', 'SLC', '(Safety Light Curtain)',  null, 20),

  -- Push Button
  ('pushButton', 'PB01', 'PB01', '(1PB)', null, 10),
  ('pushButton', 'PB02', 'PB02', '(2PB)', null, 20),
  ('pushButton', 'PB05', 'PB05', '(5PB)', null, 30),

  -- Radar
  ('radar', 'STANDARD', 'STANDARD', '(NBE Standard)',   null, 10),
  ('radar', 'FALCON',   'FALCON',   '(BEA Falcon)',     null, 20),
  ('radar', 'CONDOR',   'CONDOR',   '(BEA Condor)',     null, 30),
  ('radar', 'W-SCAN',   'W-SCAN',   '(BEA Wide Scan)',  null, 40),

  -- Remote Control
  ('remoteControl', 'R/C-4J', 'R/C-4J', '(NBE Basic 4CH)', null, 10),
  ('remoteControl', 'R/C-4',  'R/C-4',  '(Elsema 4CH)',    null, 20),
  ('remoteControl', 'R/C-8',  'R/C-8',  '(Elsema 8CH)',    null, 30),
  ('remoteControl', 'R/C-16', 'R/C-16', '(Elsema 16CH)',   null, 40),

  -- Induction Loop
  ('inductLoop', 'I/L AMP',  'I/L AMP',  '(Amplifire Only)',    null, 10),
  ('inductLoop', 'I/L FULL', 'I/L FULL', '(Full Installation)', null, 20),

  -- Other (Swipe / Access)
  ('swipe', 'SWIPE',    'SWIPE',    '(Touchless Button)', null, 10),
  ('swipe', 'P-CORD',   'P-CORD',   '(Pull Cord)',        null, 20),
  ('swipe', 'K-SWITCH', 'K-SWITCH', '(Key Switch)',       null, 30),
  ('swipe', 'RFID',     'RFID',     '(RFID)',             null, 40),
  ('swipe', 'I-LOCK',   'I-LOCK',   '(Interlock)',        null, 50),
  ('swipe', 'UPS',      'UPS',      '(UPS)',              null, 60),
  ('swipe', 'A/C',      'A/C',      '(Air Curtain)',      null, 70),

  -- Door Control
  ('doorControl', 'ENC', 'ENC', 'Encoder',      null, 10),
  ('doorControl', 'LS',  'LS',  'Limit Switch', null, 20),

  -- Frame Material
  ('frame', 'GAL', 'GAL',  'Galvanised',      null, 10),
  ('frame', 'P/C', 'P/C',  'Powder Coated',   null, 20),
  ('frame', 'S/S', 'S/S',  'Stainless Steel', null, 30),

  -- Curtain Material
  ('curtain', 'PVC900', 'PVC900', 'PVC 900 gsm',    null, 10),
  ('curtain', 'INSUL',  'INSUL',  'Insulated',       null, 20),
  ('curtain', 'FRZ',    'FRZ',    'Freezer',         null, 30),
  ('curtain', 'MESH',   'MESH',   'Mesh (Option)',   null, 40),

  -- Curtain Colour
  ('colour', 'BL 543', 'BL 543', 'Blue 543',   '#1B52D4', 10),
  ('colour', 'RD 356', 'RD 356', 'Red 356',    '#DC2626', 20),
  ('colour', 'YL 119', 'YL 119', 'Yellow 119', '#EAB308', 30),
  ('colour', 'OR 244', 'OR 244', 'Orange 244', '#F97316', 40),
  ('colour', 'GR 679', 'GR 679', 'Green 679',  '#16A34A', 50),
  ('colour', 'GY 729', 'GY 729', 'Grey 729',   '#9CA3AF', 60),
  ('colour', 'TBC',    'TBC',    'TBC',         '#E5E7EB', 70),

  -- Motor kW
  ('motorKw', '0.75', '0.75 kW', '', null, 10),
  ('motorKw', '1.5',  '1.5 kW',  '', null, 20),
  ('motorKw', '2.2',  '2.2 kW',  '', null, 30),
  ('motorKw', '3',    '3 kW',    '', null, 40),

  -- Motor Side
  ('motorSide', 'RHD', 'RHD', '', null, 10),
  ('motorSide', 'LHD', 'LHD', '', null, 20),

  -- Control Box Side
  ('controlBoxSide', 'RIGHT', 'RIGHT', '', null, 10),
  ('controlBoxSide', 'LEFT',  'LEFT',  '', null, 20)
ON CONFLICT (category, code) DO NOTHING;
