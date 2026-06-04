-- Client maintenance service-due reminders + per-client contact emails for reminders.

-- ---------------------------------------------------------------------------
-- client_contact_emails
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_contact_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  name TEXT NULL,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_contact_emails_email_nonempty CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_contact_emails_client_email
  ON public.client_contact_emails (client_id, lower(trim(email)));

CREATE INDEX IF NOT EXISTS idx_client_contact_emails_client_id
  ON public.client_contact_emails (client_id)
  WHERE is_active = true;

COMMENT ON TABLE public.client_contact_emails IS
  'Saved contact emails per client for service-due reminder communications.';

-- ---------------------------------------------------------------------------
-- client_service_due_reminders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_service_due_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  client_location_id UUID NULL REFERENCES public.client_locations (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT NULL,
  last_service_date DATE NULL,
  service_interval_months INTEGER NULL,
  due_date DATE NOT NULL,
  lead_time_days INTEGER NOT NULL,
  send_manager_email BOOLEAN NOT NULL DEFAULT true,
  send_client_email BOOLEAN NOT NULL DEFAULT false,
  client_contact_email TEXT NULL,
  client_contact_name TEXT NULL,
  client_contact_email_id UUID NULL REFERENCES public.client_contact_emails (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',
  reminder_sent_at TIMESTAMPTZ NULL,
  created_by UUID NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT client_service_due_reminders_title_len CHECK (char_length(title) <= 200),
  CONSTRAINT client_service_due_reminders_lead_time_days CHECK (lead_time_days IN (3, 5, 7, 14)),
  CONSTRAINT client_service_due_reminders_status CHECK (status IN ('active', 'cancelled', 'done')),
  CONSTRAINT client_service_due_reminders_interval_nonneg CHECK (
    service_interval_months IS NULL OR service_interval_months > 0
  )
);

CREATE INDEX IF NOT EXISTS idx_client_service_due_reminders_due_date
  ON public.client_service_due_reminders (due_date);

CREATE INDEX IF NOT EXISTS idx_client_service_due_reminders_client_id
  ON public.client_service_due_reminders (client_id);

CREATE INDEX IF NOT EXISTS idx_client_service_due_reminders_pending
  ON public.client_service_due_reminders (due_date, lead_time_days)
  WHERE status = 'active' AND reminder_sent_at IS NULL;

COMMENT ON TABLE public.client_service_due_reminders IS
  'Scheduled client maintenance service-due reminders (manager prep + optional client email).';

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.touch_client_contact_emails_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_contact_emails_updated_at ON public.client_contact_emails;
CREATE TRIGGER trg_client_contact_emails_updated_at
  BEFORE UPDATE ON public.client_contact_emails
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_client_contact_emails_updated_at();

CREATE OR REPLACE FUNCTION public.touch_client_service_due_reminders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_service_due_reminders_updated_at ON public.client_service_due_reminders;
CREATE TRIGGER trg_client_service_due_reminders_updated_at
  BEFORE UPDATE ON public.client_service_due_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_client_service_due_reminders_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.client_contact_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_service_due_reminders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.client_contact_emails FROM PUBLIC;
REVOKE ALL ON public.client_service_due_reminders FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contact_emails TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_service_due_reminders TO authenticated;

DROP POLICY IF EXISTS "client_contact_emails_select" ON public.client_contact_emails;
CREATE POLICY "client_contact_emails_select"
  ON public.client_contact_emails FOR SELECT
  TO authenticated
  USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "client_contact_emails_insert" ON public.client_contact_emails;
CREATE POLICY "client_contact_emails_insert"
  ON public.client_contact_emails FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "client_contact_emails_update" ON public.client_contact_emails;
CREATE POLICY "client_contact_emails_update"
  ON public.client_contact_emails FOR UPDATE
  TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "client_contact_emails_delete" ON public.client_contact_emails;
CREATE POLICY "client_contact_emails_delete"
  ON public.client_contact_emails FOR DELETE
  TO authenticated
  USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "client_service_due_reminders_select" ON public.client_service_due_reminders;
CREATE POLICY "client_service_due_reminders_select"
  ON public.client_service_due_reminders FOR SELECT
  TO authenticated
  USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS "client_service_due_reminders_insert" ON public.client_service_due_reminders;
CREATE POLICY "client_service_due_reminders_insert"
  ON public.client_service_due_reminders FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "client_service_due_reminders_update" ON public.client_service_due_reminders;
CREATE POLICY "client_service_due_reminders_update"
  ON public.client_service_due_reminders FOR UPDATE
  TO authenticated
  USING (public.is_manager_or_admin())
  WITH CHECK (public.is_manager_or_admin());

DROP POLICY IF EXISTS "client_service_due_reminders_delete" ON public.client_service_due_reminders;
CREATE POLICY "client_service_due_reminders_delete"
  ON public.client_service_due_reminders FOR DELETE
  TO authenticated
  USING (public.is_manager_or_admin());
