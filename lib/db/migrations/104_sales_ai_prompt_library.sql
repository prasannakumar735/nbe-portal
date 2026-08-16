-- Mirror: supabase/migrations/20260707120000_sales_ai_prompt_library.sql

CREATE TABLE IF NOT EXISTS public.sales_ai_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_name text NOT NULL,
  version integer NOT NULL,
  product_slug text NOT NULL,
  industry_slug text NOT NULL DEFAULT 'general',
  use_case_slug text NOT NULL DEFAULT 'initial_outreach',
  campaign_type_id uuid REFERENCES public.sales_campaign_types (id) ON DELETE SET NULL,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_ai_prompts_name_version_unique UNIQUE (prompt_name, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS sales_ai_prompts_active_slot_idx
  ON public.sales_ai_prompts (product_slug, industry_slug, use_case_slug)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS sales_ai_prompts_product_industry_idx
  ON public.sales_ai_prompts (product_slug, industry_slug, use_case_slug, version DESC);

CREATE INDEX IF NOT EXISTS sales_ai_prompts_prompt_name_version_idx
  ON public.sales_ai_prompts (prompt_name, version DESC);

ALTER TABLE public.sales_generated_emails
  ADD COLUMN IF NOT EXISTS prompt_name text,
  ADD COLUMN IF NOT EXISTS prompt_version integer,
  ADD COLUMN IF NOT EXISTS prompt_library_id uuid REFERENCES public.sales_ai_prompts (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sales_generated_emails_prompt_name_version_idx
  ON public.sales_generated_emails (prompt_name, prompt_version);

CREATE TABLE IF NOT EXISTS public.sales_ai_prompt_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_name text NOT NULL,
  prompt_version integer NOT NULL,
  reply_rate numeric,
  approval_rate numeric,
  conversion_rate numeric,
  sample_size integer NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sales_ai_prompt_metrics_name_version_idx
  ON public.sales_ai_prompt_metrics (prompt_name, prompt_version, computed_at DESC);
