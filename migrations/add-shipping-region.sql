-- Add shipping_region column to offers and requests
-- Run in Supabase SQL Editor

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS shipping_region text
  CHECK (shipping_region IN ('domestic', 'international', 'worldwide'));

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS shipping_region text
  CHECK (shipping_region IN ('domestic', 'international', 'worldwide'));
