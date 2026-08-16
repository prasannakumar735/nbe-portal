-- Global outbound email suppression list.
--
-- Keyed on the NORMALISED EMAIL ADDRESS, not contact_id, deliberately:
-- rescanning a postcode re-inserts the same business as a new sales_contacts
-- row with a new id, so contact-scoped suppression silently lapses and the same
-- person is emailed again. Address-scoped suppression survives rediscovery.
--
-- Scope is global (all campaigns). An unsubscribe means stop sending commercial
-- messages, not stop sending this one campaign (Spam Act 2003 (Cth) s18).

CREATE TABLE IF NOT EXISTS public.sales_email_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  /** Lowercased + trimmed by lib/sales/suppression/normalizeEmail.ts before write. */
  email_address text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('unsubscribed', 'bounced', 'complained', 'manual')),
  /** Context only — suppression applies regardless of which campaign triggered it. */
  contact_id uuid REFERENCES public.sales_contacts (id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES public.sales_campaigns (id) ON DELETE SET NULL,
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One live suppression per address; repeat opt-outs are idempotent upserts.
CREATE UNIQUE INDEX IF NOT EXISTS sales_email_suppressions_email_key
  ON public.sales_email_suppressions (email_address);

CREATE INDEX IF NOT EXISTS sales_email_suppressions_created_at_idx
  ON public.sales_email_suppressions (created_at DESC);

COMMENT ON TABLE public.sales_email_suppressions IS
  'Global do-not-email list keyed on normalised email address. Checked before every outbound sales send.';

-- RLS: no policies by design.
--
-- With RLS enabled and zero policies, this table is unreachable through the
-- anon/authenticated API (the browser holds the anon key). The service-role
-- client bypasses RLS, so all reads/writes must go through server code —
-- see lib/sales/repositories/salesEmailSuppressionRepository.ts.
--
-- A suppression list that could be deleted from the client would let an
-- unsubscribe be undone, so client access is refused outright rather than
-- policy-scoped.
ALTER TABLE public.sales_email_suppressions ENABLE ROW LEVEL SECURITY;
