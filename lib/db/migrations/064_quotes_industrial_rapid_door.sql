-- Industrial Rapid Door quotes: kind + validity + optional item title column

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS quote_kind TEXT NOT NULL DEFAULT 'service';

COMMENT ON COLUMN quotes.quote_kind IS 'service | rapid_door — distinguishes quote templates and listings';

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS valid_until DATE;

COMMENT ON COLUMN quotes.valid_until IS 'Quote validity end date (Industrial Rapid Door layout)';

CREATE INDEX IF NOT EXISTS idx_quotes_quote_kind ON quotes(quote_kind);

ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS item_title TEXT;

COMMENT ON COLUMN quote_items.item_title IS 'Industrial Rapid Door PDF ITEM column; optional';
