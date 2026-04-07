-- Optional: store merged maintenance reports (PDFs generated on-demand)

CREATE TABLE IF NOT EXISTS public.merged_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  report_ids UUID[] NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  file_url TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_merged_reports_client_created_at
  ON public.merged_reports (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merged_reports_report_ids_gin
  ON public.merged_reports USING GIN (report_ids);

