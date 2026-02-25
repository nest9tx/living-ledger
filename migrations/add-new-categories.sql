-- ============================================================
-- New Categories Migration
-- Run this in Supabase → SQL Editor
-- Safe to re-run (ON CONFLICT DO NOTHING)
-- ============================================================

INSERT INTO categories (name, icon) VALUES
  -- Apparel & Accessories
  ('Fashion & Apparel',         '👗'),
  ('Jewelry & Accessories',     '💍'),
  -- Health, Beauty & Wellness
  ('Apothecary & Herbals',      '🌿'),
  ('Health & Beauty',           '💄'),
  -- Home & Lifestyle
  ('Home Goods',                '🏡'),
  ('Books & Media',             '📖'),
  ('Electronics',               '📱'),
  ('Sports & Outdoors',         '⛷️'),
  ('Hobbies & Supplies',        '🎯'),
  -- Specialty
  ('Baby & Kids',               '👶'),
  ('Pet Supplies',              '🐾'),
  ('Coins & Currency',          '🪙')
ON CONFLICT (name) DO NOTHING;
