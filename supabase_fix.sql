-- ============================================================
-- supabase_fix.sql — Safe to run multiple times
-- Paste into: Supabase Dashboard → SQL Editor → New Query
-- Run this if quiz results or leaderboard scores are not saving.
-- ============================================================

-- ── quiz_results ──────────────────────────────────────────────
-- Create table if it doesn't exist
CREATE TABLE IF NOT EXISTS quiz_results (
  id          BIGSERIAL PRIMARY KEY,
  result_type TEXT NOT NULL
    CHECK (result_type IN ('Freethinker','Classic','Rebel','Unaware')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (idempotent)
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

-- Re-create policies (drop first so it's safe to re-run)
DROP POLICY IF EXISTS "Public read qr"   ON quiz_results;
DROP POLICY IF EXISTS "Public insert qr" ON quiz_results;
CREATE POLICY "Public read qr"   ON quiz_results FOR SELECT USING (true);
CREATE POLICY "Public insert qr" ON quiz_results FOR INSERT WITH CHECK (true);

-- Ensure Realtime is on (no-op if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE quiz_results;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── leaderboard ───────────────────────────────────────────────
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read lb"   ON leaderboard;
DROP POLICY IF EXISTS "Public insert lb" ON leaderboard;
CREATE POLICY "Public read lb"   ON leaderboard FOR SELECT USING (true);
CREATE POLICY "Public insert lb" ON leaderboard FOR INSERT WITH CHECK (true);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Verify ────────────────────────────────────────────────────
-- Should list: leaderboard, quiz_results, votes
SELECT tablename
FROM   pg_publication_tables
WHERE  pubname = 'supabase_realtime'
ORDER  BY tablename;
