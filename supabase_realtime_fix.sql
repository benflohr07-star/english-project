-- ============================================================
-- Realtime publication refresh
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- After any ALTER TABLE on a replicated table, PostgreSQL's WAL
-- can lose track of the table in the publication.  Re-adding the
-- table refreshes the slot and restores live Realtime events.
--
-- Run this if the admin dashboard stops receiving live updates.
-- ============================================================

-- ── votes ─────────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS votes;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;

-- ── quiz_results ──────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS quiz_results;
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_results;

-- ── leaderboard (in case it drifted too) ──────────────────────────────────────
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;

-- ── Verify all three are present ──────────────────────────────────────────────
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('votes', 'quiz_results', 'leaderboard')
ORDER BY tablename;

-- Expected: 3 rows, one for each table.
-- If any are missing, the Realtime subscription for that table is broken.
