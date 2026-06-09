-- ============================================================
-- Gender column migration
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- Adds a nullable `gender` column to both the `votes` and
-- `quiz_results` tables.  NULL = "Prefer not to say".
-- The CHECK constraint accepts only the two explicit values
-- so no other strings can be inserted.
-- ============================================================

-- ── votes ─────────────────────────────────────────────────────────────────────
ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS gender text
  CONSTRAINT votes_gender_check CHECK (gender IN ('Boy', 'Girl'));

-- ── quiz_results ──────────────────────────────────────────────────────────────
ALTER TABLE quiz_results
  ADD COLUMN IF NOT EXISTS gender text
  CONSTRAINT quiz_results_gender_check CHECK (gender IN ('Boy', 'Girl'));

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name IN ('votes', 'quiz_results')
  AND column_name = 'gender'
ORDER BY table_name;

-- ============================================================
-- Expected result: two rows — one for votes, one for quiz_results
--   data_type  = text
--   is_nullable = YES        (NULL = "Prefer not to say")
-- ============================================================
