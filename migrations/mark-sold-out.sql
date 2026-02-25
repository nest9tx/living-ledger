-- Add is_sold_out flag to offers and requests
-- This is set automatically when all quantity slots are filled by escrow purchases.
-- Cleared automatically when the seller restocks.

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS is_sold_out boolean DEFAULT false;

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS is_sold_out boolean DEFAULT false;
