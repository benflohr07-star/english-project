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
-- 4. Verify setup
-- ============================================================
-- SELECT * FROM votes LIMIT 5;
-- SELECT question_id, choice, COUNT(*) FROM votes GROUP BY 1,2 ORDER BY 1,2;
-- Check Realtime is active:
-- SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';
