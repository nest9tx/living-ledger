-- Add suspended column to offers and requests tables
-- Suspended listings are hidden from the public feed but not deleted
-- Admins can reinstate them at any time

ALTER TABLE offers
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

ALTER TABLE requests
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

-- Index for efficient filtering in public feed queries
CREATE INDEX IF NOT EXISTS idx_offers_not_suspended ON offers (suspended) WHERE suspended = false;
CREATE INDEX IF NOT EXISTS idx_requests_not_suspended ON requests (suspended) WHERE suspended = false;
