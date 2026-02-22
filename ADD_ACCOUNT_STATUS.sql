-- ============================================================
-- Account status (suspend / ban) + suspension reason
-- Run this in the Supabase SQL Editor.
-- ============================================================
-- account_status values:
--   'active'    → normal account (default)
--   'suspended' → account restricted; user can log in but cannot
--                 post listings or initiate orders
--   'banned'    → account fully disabled via Supabase Auth ban;
--                 user cannot log in at all
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS account_status   text        NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'suspended', 'banned')),
  ADD COLUMN IF NOT EXISTS suspension_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at     timestamptz;

-- Backfill existing rows (safety — all existing users are active)
UPDATE profiles SET account_status = 'active' WHERE account_status IS NULL;
