-- ============================================================
-- Rate Limit table for the check-rate-limit Edge Function
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Tracks every action the Edge Function allows.
-- Anon users have NO direct access (all access is via the Edge
-- Function which uses the service-role key to bypass RLS).
CREATE TABLE IF NOT EXISTS rate_limit (
  id         BIGSERIAL PRIMARY KEY,
  user_id    TEXT        NOT NULL CHECK (char_length(user_id) BETWEEN 1 AND 64),
  action     TEXT        NOT NULL CHECK (char_length(action)  BETWEEN 1 AND 64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for the hot query: count rows for user_id + action in a time window
CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup
  ON rate_limit (user_id, action, created_at DESC);

-- Enable RLS — but intentionally add NO anon policies.
-- Only the service-role key (Edge Function) can read/write this table.
ALTER TABLE rate_limit ENABLE ROW LEVEL SECURITY;

-- NOT added to supabase_realtime — no Realtime needed here.

-- ── Verify ────────────────────────────────────────────────────
-- After running, confirm the table is present:
-- SELECT tablename FROM information_schema.tables
-- WHERE table_schema = 'public' AND tablename = 'rate_limit';
