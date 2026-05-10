-- Manager taxonomy: quote type + sub-category (see lib/quotes/quoteTaxonomy.ts)

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_type TEXT;

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_sub_category TEXT;

COMMENT ON COLUMN quotes.quote_type IS 'service | repair | parts_replacement | new_installation (portal taxonomy)';
COMMENT ON COLUMN quotes.quote_sub_category IS 'Slug matching quoteTaxonomy option value';

CREATE INDEX IF NOT EXISTS idx_quotes_quote_type ON quotes(quote_type);

UPDATE quotes
SET quote_type = 'new_installation',
    quote_sub_category = 'rapid_door'
WHERE quote_kind = 'rapid_door'
  AND (quote_type IS NULL OR quote_sub_category IS NULL);

UPDATE quotes
SET quote_type = 'service',
    quote_sub_category = 'annual_service'
WHERE quote_kind = 'service'
  AND quote_type IS NULL;
