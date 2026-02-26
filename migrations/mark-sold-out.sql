-- Add is_sold_out flag to offers and requests
-- This is set automatically when all quantity slots are filled by escrow purchases.
-- Cleared automatically when the seller restocks.

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS is_sold_out boolean DEFAULT false;

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS is_sold_out boolean DEFAULT false;

-- Backfill: mark any already-sold-out listings that existed before this column was added
UPDATE offers o
SET is_sold_out = true
WHERE o.quantity IS NOT NULL
  AND (
    SELECT COUNT(*) FROM credit_escrow e
    WHERE e.offer_id = o.id
      AND e.status NOT IN ('refunded', 'cancelled')
  ) >= o.quantity;

UPDATE requests r
SET is_sold_out = true
WHERE r.quantity IS NOT NULL
  AND (
    SELECT COUNT(*) FROM credit_escrow e
    WHERE e.request_id = r.id
      AND e.status NOT IN ('refunded', 'cancelled')
  ) >= r.quantity;
