// Supabase Edge Function: cleanup-leaderboard
// ─────────────────────────────────────────────────────────────────────────────
// Deletes stale rows from two tables:
//   • leaderboard  — rows older than 7 days
//   • rate_limit   — rows older than 24 hours
//
// Deploy:
//   supabase functions deploy cleanup-leaderboard
//
// Schedule (pg_cron — see supabase_cleanup_cron.sql):
//   0 2 * * *  → runs every night at 02:00 UTC
//
// Response shape:
//   { ok: true, deleted_leaderboard: number, deleted_rate_limits: number, ran_at: string }
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  const ran_at = new Date().toISOString()
  console.log(`[cleanup-leaderboard] ── Starting at ${ran_at} ──`)

  try {
    // Service-role key bypasses RLS so the function can delete any row
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const oneDayAgo    = new Date(Date.now() -      24 * 60 * 60 * 1000).toISOString()

    // ── 1. Leaderboard: count then delete ─────────────────────────────────────
    const { count: lbCount, error: lbCountErr } = await supabase
      .from('leaderboard')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', sevenDaysAgo)

    if (lbCountErr) throw new Error(`leaderboard count: ${lbCountErr.message}`)

    const { error: lbDelErr } = await supabase
      .from('leaderboard')
      .delete()
      .lt('created_at', sevenDaysAgo)

    if (lbDelErr) throw new Error(`leaderboard delete: ${lbDelErr.message}`)

    const deleted_leaderboard = lbCount ?? 0
    console.log(
      `[cleanup-leaderboard] Leaderboard: deleted ${deleted_leaderboard} row(s)` +
      ` older than 7 days (threshold: ${sevenDaysAgo})`
    )

    // ── 2. Rate limit: count then delete ──────────────────────────────────────
    const { count: rlCount, error: rlCountErr } = await supabase
      .from('rate_limit')
      .select('id', { count: 'exact', head: true })
      .lt('created_at', oneDayAgo)

    if (rlCountErr) throw new Error(`rate_limit count: ${rlCountErr.message}`)

    const { error: rlDelErr } = await supabase
      .from('rate_limit')
      .delete()
      .lt('created_at', oneDayAgo)

    if (rlDelErr) throw new Error(`rate_limit delete: ${rlDelErr.message}`)

    const deleted_rate_limits = rlCount ?? 0
    console.log(
      `[cleanup-leaderboard] Rate limit: deleted ${deleted_rate_limits} row(s)` +
      ` older than 24 hours (threshold: ${oneDayAgo})`
    )

    // ── 3. Summary ────────────────────────────────────────────────────────────
    console.log(
      `[cleanup-leaderboard] ── Done. ` +
      `leaderboard=${deleted_leaderboard} rate_limit=${deleted_rate_limits} ──`
    )

    return new Response(
      JSON.stringify({ ok: true, deleted_leaderboard, deleted_rate_limits, ran_at }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[cleanup-leaderboard] ERROR: ${message}`)

    return new Response(
      JSON.stringify({ ok: false, error: message, ran_at }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
