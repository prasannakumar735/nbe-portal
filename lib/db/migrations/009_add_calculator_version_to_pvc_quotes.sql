-- Migration: add calculator version tracking for PVC quote records

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'pvc_quotes'
  ) THEN
    ALTER TABLE public.pvc_quotes
      ADD COLUMN IF NOT EXISTS calculator_version TEXT;
  END IF;
END $$;
