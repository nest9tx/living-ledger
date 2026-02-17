-- ESCROW MUTUAL CONFIRMATION SYSTEM
-- Implements Fiverr/Etsy-style escrow with 7-day hold + mutual confirmation

-- Add new columns to credit_escrow table
ALTER TABLE credit_escrow
ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
ADD COLUMN IF NOT EXISTS payer_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS provider_confirmed_at timestamptz,
ADD COLUMN IF NOT EXISTS release_available_at timestamptz,
ADD COLUMN IF NOT EXISTS dispute_reported_at timestamptz;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_escrow_status ON credit_escrow(status);
CREATE INDEX IF NOT EXISTS idx_escrow_delivered ON credit_escrow(delivered_at);
CREATE INDEX IF NOT EXISTS idx_escrow_release_available ON credit_escrow(release_available_at);

-- ESCROW STATUS STATES:
-- 'held': Initial - funds in escrow, work not yet delivered
-- 'delivered': Work marked complete by buyer, 7-day hold started
-- 'confirmed': Both parties confirmed (can be released immediately)
-- 'released': Funds released to provider
-- 'refunded': Funds returned to payer
-- 'disputed': In dispute, admin intervention needed

COMMENT ON TABLE credit_escrow IS 'Holds credits during service completion with mutual confirmation mechanism';
COMMENT ON COLUMN credit_escrow.delivered_at IS 'When buyer marks service as delivered/completed';
COMMENT ON COLUMN credit_escrow.payer_confirmed_at IS 'When payer confirms satisfaction with delivery';
COMMENT ON COLUMN credit_escrow.provider_confirmed_at IS 'When provider confirms delivery was completed';
COMMENT ON COLUMN credit_escrow.release_available_at IS 'When 7-day hold expires and funds can auto-release';
COMMENT ON COLUMN credit_escrow.dispute_reported_at IS 'When dispute was reported (blocks confirmation)';

-- Migration complete
SELECT 'Escrow mutual confirmation system initialized' as status;
