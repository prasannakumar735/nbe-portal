-- QR Contact Management
-- Creates contacts table used for vCard and dynamic QR flows.

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company TEXT,
  title TEXT,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  qr_type TEXT NOT NULL DEFAULT 'dynamic',
  profile_image_url TEXT,
  company_logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT contacts_status_check CHECK (status IN ('active', 'inactive')),
  CONSTRAINT contacts_qr_type_check CHECK (qr_type IN ('vcard', 'dynamic'))
);

CREATE INDEX IF NOT EXISTS idx_contacts_slug ON contacts (slug);
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts (status);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts (created_at DESC);
