-- ============================================================
-- Supabase Setup for "Stereotypes in Movies & Childhood"
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. Create the votes table
CREATE TABLE IF NOT EXISTS votes (
  id          BIGSERIAL PRIMARY KEY,
  question_id INTEGER NOT NULL CHECK (question_id BETWEEN 0 AND 5),
  choice      INTEGER NOT NULL CHECK (choice >= 0),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast aggregation queries
CREATE INDEX IF NOT EXISTS idx_votes_question_choice
  ON votes (question_id, choice);

-- ============================================================
-- 2. Row Level Security — allow anonymous read + insert
-- ============================================================
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read votes (needed to display live results)
CREATE POLICY "Public read"
  ON votes FOR SELECT
  USING (true);

-- Anyone can cast one row per visit (no auth required)
CREATE POLICY "Public insert"
  ON votes FOR INSERT
  WITH CHECK (
    question_id BETWEEN 0 AND 5
    AND choice >= 0
  );

-- ============================================================
-- 3. Enable Realtime — REQUIRED for live bar chart updates
--    Without this, postgres_changes events will not fire.
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- Also add a DELETE policy so old test rows can be cleaned up
-- (optional — only needed if you want to delete rows via the anon key)
CREATE POLICY "Public delete"
  ON votes FOR DELETE
  USING (true);

-- ============================================================
-- 4. Leaderboard table (Section 01 — Guess the stat)
-- ============================================================
CREATE TABLE IF NOT EXISTS leaderboard (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 20),
  score      INTEGER NOT NULL CHECK (score >= 0 AND score <= 900),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score
  ON leaderboard (score DESC);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read lb"
  ON leaderboard FOR SELECT USING (true);

CREATE POLICY "Public insert lb"
  ON leaderboard FOR INSERT WITH CHECK (true);

-- Enable Realtime for live leaderboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;

-- Admin reset function — change 'teacher2025' to your own password
CREATE OR REPLACE FUNCTION reset_leaderboard(admin_pass TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF admin_pass = 'teacher2025' THEN
    DELETE FROM leaderboard;
  ELSE
    RAISE EXCEPTION 'Unauthorized: wrong admin password';
  END IF;
END;
$$;

-- ============================================================
-- 5. Quiz results table (Section 03 — What type are you?)
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_results (
  id          BIGSERIAL PRIMARY KEY,
  result_type TEXT NOT NULL
    CHECK (result_type IN ('Freethinker','Classic','Rebel','Unaware')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read qr"   ON quiz_results FOR SELECT USING (true);
CREATE POLICY "Public insert qr" ON quiz_results FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE quiz_results;

-- ============================================================
-- 6. Combined admin reset (votes + quiz_results + leaderboard)
--    Called from the admin dashboard — change password below
-- ============================================================
CREATE OR REPLACE FUNCTION reset_all(admin_pass TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF admin_pass = 'teacher2025' THEN
    DELETE FROM votes;
    DELETE FROM quiz_results;
    DELETE FROM leaderboard;
  ELSE
    RAISE EXCEPTION 'Unauthorized: wrong admin password';
  END IF;
END;
$$;

-- ============================================================
-- 7. Verify setup
-- ============================================================
-- SELECT * FROM votes LIMIT 5;
-- SELECT question_id, choice, COUNT(*) FROM votes GROUP BY 1,2 ORDER BY 1,2;
-- Check Realtime is active:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
