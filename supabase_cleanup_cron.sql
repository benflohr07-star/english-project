-- ============================================================
-- Cron job: run cleanup-leaderboard Edge Function nightly
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- Prerequisites (one-time, done in Dashboard → Database → Extensions):
--   • pg_cron   must be ENABLED
--   • pg_net    must be ENABLED
-- ============================================================

-- Step 1 — Enable extensions (safe to re-run)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2 — Remove any previous version of this job (idempotent)
SELECT cron.unschedule('cleanup-leaderboard')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-leaderboard');

-- Step 3 — Create the cron job
--   Schedule:  0 2 * * *  =  every day at 02:00 UTC
--   The anon key is safe to embed here (it is already public in app.js).
--   The Edge Function itself uses the service-role key internally for DB writes.
SELECT cron.schedule(
  'cleanup-leaderboard',          -- unique job name
  '0 2 * * *',                    -- cron expression: daily at 02:00 UTC
  $$
  SELECT net.http_post(
    url     := 'https://akuvykkoonkvdnumbatd.supabase.co/functions/v1/cleanup-leaderboard',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrdXZ5a2tvb25rdmRudW1iYXRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5ODMzMDEsImV4cCI6MjA5NTU1OTMwMX0.SBOTW1ozBT16gZvOKvgE-VadENq9pTjzIU3JRAWJ0Xs'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Step 4 — Verify the job was created
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  username
FROM cron.job
WHERE jobname = 'cleanup-leaderboard';

-- ============================================================
-- Useful maintenance queries
-- ============================================================

-- See the last 20 run results:
-- SELECT * FROM cron.job_run_details
-- WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'cleanup-leaderboard')
-- ORDER BY start_time DESC LIMIT 20;

-- Temporarily pause the job (active = false):
-- UPDATE cron.job SET active = false WHERE jobname = 'cleanup-leaderboard';

-- Re-enable it:
-- UPDATE cron.job SET active = true  WHERE jobname = 'cleanup-leaderboard';

-- Remove the job entirely:
-- SELECT cron.unschedule('cleanup-leaderboard');
