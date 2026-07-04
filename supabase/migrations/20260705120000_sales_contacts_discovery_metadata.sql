-- Sales Engine: contact discovery audit fields and outreach recommendation flag.

ALTER TABLE public.sales_contacts
  ADD COLUMN IF NOT EXISTS discovery_page_title text,
  ADD COLUMN IF NOT EXISTS discovery_method text,
  ADD COLUMN IF NOT EXISTS page_kind text,
  ADD COLUMN IF NOT EXISTS recommended_for_outreach boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recommended_reason text;

COMMENT ON COLUMN public.sales_contacts.discovery_page_title IS
  'HTML page title where the contact was discovered.';
COMMENT ON COLUMN public.sales_contacts.discovery_method IS
  'How the contact was extracted (e.g. mailto, mailto_labeled, body_text).';
COMMENT ON COLUMN public.sales_contacts.page_kind IS
  'Crawl context: homepage, contact, branch, locations_hub, etc.';
COMMENT ON COLUMN public.sales_contacts.recommended_for_outreach IS
  'True when the discovery job recommends this contact for campaigns.';
COMMENT ON COLUMN public.sales_contacts.recommended_reason IS
  'Human-readable explanation for the outreach recommendation.';

CREATE INDEX IF NOT EXISTS sales_contacts_business_recommended_idx
  ON public.sales_contacts (business_id, recommended_for_outreach)
  WHERE recommended_for_outreach = true;
