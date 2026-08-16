-- Phase 8.5: Prompt Library description + metrics table documentation.

ALTER TABLE public.sales_ai_prompts
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.sales_ai_prompts.description IS
  'Optional human-readable label for managers (UI list/detail).';

COMMENT ON TABLE public.sales_ai_prompt_metrics IS
  'Reporting snapshots only. Rates must be derived from raw campaign events (replies, approvals, conversions) and written here by analytics jobs—not maintained manually as source of truth.';
