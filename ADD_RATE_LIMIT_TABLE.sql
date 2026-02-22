-- ============================================================
-- Persistent rate limit log — backs the API rate limiter.
-- Replaces the in-memory Map so limits are shared across ALL
-- Vercel serverless instances (the in-memory store was reset
-- on every cold start and not shared between concurrent workers).
--
-- Run this once in the Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS rate_limit_log (
  id         bigserial    PRIMARY KEY,
  key        text         NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now()
);

-- Fast lookup by key within a time window
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_key_time
  ON rate_limit_log (key, created_at DESC);

-- Index for cleanup queries (deleting expired rows)
CREATE INDEX IF NOT EXISTS idx_rate_limit_log_created
  ON rate_limit_log (created_at);

-- This table is accessed server-side only via the service role key.
-- RLS is not needed and would add unnecessary overhead.
ALTER TABLE rate_limit_log DISABLE ROW LEVEL SECURITY;
