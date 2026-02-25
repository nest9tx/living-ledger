-- ============================================================
-- Physical Goods Migration
-- Run this in Supabase → SQL Editor
-- ============================================================

-- 1. Add physical-goods columns to offers
ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS is_physical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_credits integer;

-- 2. Add physical-goods columns to requests
ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS is_physical boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_credits integer;

-- 3. Add new physical-goods categories
--    Uses INSERT ... ON CONFLICT DO NOTHING so it's safe to re-run
INSERT INTO categories (name, icon) VALUES
  ('Collectibles',   '🏆'),
  ('Custom & Made-to-Order', '🛠️'),
  ('Pre-made Goods', '📦'),
  ('Antiques',       '🏛️'),
  ('Toys & Games',   '🧸'),
  ('Art & Prints',   '🖼️'),
  ('Crafts & DIY',   '🧵'),
  ('Misc Physical',  '📫')
ON CONFLICT (name) DO NOTHING;
