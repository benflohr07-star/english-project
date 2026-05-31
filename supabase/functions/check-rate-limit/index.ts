// Supabase Edge Function: check-rate-limit
// Deploy: supabase functions deploy check-rate-limit
//
// POST body: { user_id: string, action: string }
// Returns:
//   200 { ok: true }            — action allowed, entry recorded
//   429 { error: "...", retryAfter: 3600 } — rate limit exceeded
//   400/500 on bad input / server error
//
// Uses the service-role key (bypasses RLS) so anon users cannot
// manipulate the rate_limit table directly.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const WINDOW_MS   = 60 * 60 * 1000   // 1 hour sliding window
const MAX_ACTIONS = 3                 // max inserts per user_id+action in WINDOW_MS

Deno.serve(async (req: Request) => {
  // Preflight for browser CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const body = await req.json()
    const { user_id, action } = body

    // Basic input validation
    if (
      !user_id || typeof user_id !== 'string' ||
      !action  || typeof action  !== 'string'
    ) {
      return json({ error: 'user_id and action are required strings' }, 400)
    }
    if (user_id.length > 64 || action.length > 64) {
      return json({ error: 'Field too long (max 64 chars)' }, 400)
    }

    // Service-role client bypasses RLS — anon cannot touch rate_limit directly
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')  ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const windowStart = new Date(Date.now() - WINDOW_MS).toISOString()

    // Count how many times this user has performed this action in the window
    const { count, error: countErr } = await supabase
      .from('rate_limit')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .eq('action',  action)
      .gte('created_at', windowStart)

    if (countErr) throw countErr

    if ((count ?? 0) >= MAX_ACTIONS) {
      return json({ error: 'Rate limit exceeded', retryAfter: 3600 }, 429)
    }

    // Record the action
    const { error: insertErr } = await supabase
      .from('rate_limit')
      .insert({ user_id, action })

    if (insertErr) throw insertErr

    // Opportunistic cleanup: prune rows older than the window so the
    // table stays small without needing a separate cron job.
    await supabase
      .from('rate_limit')
      .delete()
      .lt('created_at', windowStart)

    return json({ ok: true })

  } catch (err) {
    console.error('check-rate-limit error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
