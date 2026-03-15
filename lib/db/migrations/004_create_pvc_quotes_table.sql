-- Migration: Ensure pvc_quotes table exists for generated PDF quote records

CREATE TABLE IF NOT EXISTS public.pvc_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    width_mm NUMERIC(10, 2),
    height_mm NUMERIC(10, 2),
    strip_type TEXT,
    strip_width_mm NUMERIC(10, 2),
    strip_count NUMERIC(10, 2),
    final_price NUMERIC(12, 2),
    pdf_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvc_quotes_created_at ON public.pvc_quotes(created_at DESC);
