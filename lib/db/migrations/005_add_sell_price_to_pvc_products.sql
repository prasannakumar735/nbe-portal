-- Migration: add sell_price to pvc_products for legacy Excel-aligned selling rates

ALTER TABLE IF EXISTS public.pvc_products
  ADD COLUMN IF NOT EXISTS sell_price NUMERIC(12, 4);

-- Backfill: default sell_price to existing cost_price where missing
UPDATE public.pvc_products
SET sell_price = cost_price
WHERE sell_price IS NULL
  AND cost_price IS NOT NULL;

-- Legacy example overrides (only applied if matching product names exist)
UPDATE public.pvc_products
SET sell_price = 3.33
WHERE product_name ILIKE '%PVC Strip Rib Std 100mm x 2mm%';

UPDATE public.pvc_products
SET sell_price = 4.85
WHERE product_name ILIKE '%PVC Strip Rib Std 150mm x 2mm%';

UPDATE public.pvc_products
SET sell_price = 6.40
WHERE product_name ILIKE '%PVC Strip Rib Std 200mm x 2mm%';
