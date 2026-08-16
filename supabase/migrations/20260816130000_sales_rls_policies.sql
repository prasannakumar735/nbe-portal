-- Sales Engine: enable RLS on all sales_* tables and add access policies.
--
-- Two security tiers:
--
--   1. SERVICE-ROLE ONLY — RLS enabled with zero policies.
--      These tables contain internal audit data (delivery logs, LLM logs,
--      agent state, mailbox sync) that no browser client should ever read or
--      write. Only the service-role client (server-side cron / worker code)
--      can access them.
--
--   2. MANAGER/ADMIN — full read + write via authenticated session.
--      The sales portal is restricted to users whose profiles.role is 'admin'
--      or 'manager'. A single helper function centralises the role check so
--      it never diverges across tables.
--
-- sales_email_suppressions was handled in 20260816120000 — not repeated here.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Helper: is the current authenticated user a manager or admin?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_sales_manager_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  )
$$;

-- ---------------------------------------------------------------------------
-- Tier 1: service-role-only tables (RLS on, no policies)
-- ---------------------------------------------------------------------------

ALTER TABLE public.sales_email_delivery_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_agent_runs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_generation_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_mailbox_sync_state   ENABLE ROW LEVEL SECURITY;

-- sales_contact_scan_logs contains raw crawl HTML and is large; keep server-side.
ALTER TABLE public.sales_contact_scan_logs    ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Tier 2: manager/admin tables (RLS on + full-access policy for manager/admin)
-- ---------------------------------------------------------------------------
-- Each table gets a single permissive policy that allows SELECT + INSERT +
-- UPDATE + DELETE for authenticated managers and admins. Splitting into
-- separate per-operation policies adds no security value here (the portal
-- front-end needs all four), but would be easy to tighten later.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'sales_businesses',
    'sales_contacts',
    'sales_campaigns',
    'sales_campaign_contacts',
    'sales_campaign_types',
    'sales_generated_emails',
    'sales_generated_email_attachments',
    'sales_email_send_queue',
    'sales_email_templates',
    'sales_email_threads',
    'sales_email_messages',
    'sales_email_quality_scores',
    'sales_engagement_events',
    'sales_contact_engagement',
    'sales_followup_queue',
    'sales_followup_sequences',
    'sales_generation_jobs',
    'sales_scan_runs',
    'sales_manager_notifications',
    'sales_offer_attachments',
    'sales_offer_types',
    'sales_pipeline_opportunities',
    'sales_reply_analysis',
    'sales_reply_drafts',
    'sales_ai_prompts'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    -- Drop and recreate so the migration is idempotent.
    EXECUTE format(
      'DROP POLICY IF EXISTS sales_manager_admin_access ON public.%I',
      tbl
    );
    EXECUTE format(
      $p$
        CREATE POLICY sales_manager_admin_access ON public.%I
          FOR ALL
          TO authenticated
          USING (public.is_sales_manager_or_admin())
          WITH CHECK (public.is_sales_manager_or_admin())
      $p$,
      tbl
    );
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- sales_engine_settings: admin-only write, manager read
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales_engine_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_settings_manager_read    ON public.sales_engine_settings;
DROP POLICY IF EXISTS sales_settings_admin_write     ON public.sales_engine_settings;

CREATE POLICY sales_settings_manager_read ON public.sales_engine_settings
  FOR SELECT
  TO authenticated
  USING (public.is_sales_manager_or_admin());

CREATE POLICY sales_settings_admin_write ON public.sales_engine_settings
  FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
