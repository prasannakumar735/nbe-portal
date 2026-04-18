-- Full service quote form round-trip (notes, header, signature, line items with UI field names)

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS form_snapshot JSONB;

COMMENT ON COLUMN quotes.form_snapshot IS 'Full ServiceQuoteFormValues JSON for view/edit/PDF parity';
