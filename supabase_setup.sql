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
-- 3. (Optional) Seed with zeros so every option always exists
--    Only needed if you query by question_id+choice with a
--    separate aggregate table. For the current JS approach
--    (SELECT * then count in-memory) this is not required.
-- ============================================================

-- ============================================================
-- 4. Verify setup
-- ============================================================
-- SELECT * FROM votes LIMIT 5;
-- SELECT question_id, choice, COUNT(*) FROM votes GROUP BY 1,2 ORDER BY 1,2;
