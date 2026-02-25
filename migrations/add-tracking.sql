-- ============================================================
-- Shipping Tracking Migration
-- Run this in Supabase → SQL Editor
-- Safe to re-run (IF NOT EXISTS)
-- ============================================================

ALTER TABLE credit_escrow
  ADD COLUMN IF NOT EXISTS tracking_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_number  text;
