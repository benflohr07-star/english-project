// Supabase Edge Function: generate-analysis
// ─────────────────────────────────────────────────────────────────────────────
// Accepts POST { answers: [{question, answer}], resultType: string }
// Calls OpenAI gpt-4o-mini with stream:true and pipes the plain-text delta
// stream directly back to the browser — the API key never touches the frontend.
//
// Deploy:
//   supabase functions deploy generate-analysis
//
// Secret (set once):
//   supabase secrets set OPENAI_API_KEY=sk-...
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Human-readable labels for each result type
const RESULT_LABELS: Record<string, string> = {
  'Freethinker': 'The Freethinker — grew up with few gender restrictions and self-directed choices',
  'Classic':     'The Classic — childhood followed traditional gender roles and clear expectations',
  'Rebel':       'The Rebel — pushed back against gender norms, consciously or not',
  'Unaware':     'The Unaware — was subtly shaped by stereotypes without fully noticing',
}

Deno.serve(async (req: Request) => {
  // ── Preflight ────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: { answers?: Array<{ question: string; answer: string }>; resultType?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  const { answers, resultType } = body

  if (!Array.isArray(answers) || answers.length === 0 || !resultType) {
    return new Response(
      JSON.stringify({ error: 'Missing or empty answers / resultType' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // ── API key ──────────────────────────────────────────────────────────────
  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    console.error('[generate-analysis] OPENAI_API_KEY secret is not set')
    return new Response(
      JSON.stringify({ error: 'AI service not configured' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // ── Build prompt ─────────────────────────────────────────────────────────
  const resultLabel = RESULT_LABELS[resultType] ?? resultType
  const qaBlock = answers
    .map((a, i) => `Q${i + 1}: ${a.question}\nAnswer: ${a.answer}`)
    .join('\n\n')

  const systemPrompt =
    'You are an empathetic analyst helping a student reflect on how childhood gender stereotypes shaped their upbringing. ' +
    'Write in warm, direct second-person prose. Keep it to 3–4 sentences. ' +
    'No bullet points, no headers. Reference their specific answers naturally. ' +
    'End on something thought-provoking but encouraging.'

  const userPrompt =
    `This person's quiz result is: "${resultLabel}".\n\n` +
    `Here are their answers:\n\n${qaBlock}\n\n` +
    'Write a short personal analysis (3–4 sentences) that reflects on their specific answers ' +
    'and what those reveal about stereotype influence in their childhood. ' +
    'Make it feel personal and insightful, not generic.'

  // ── Call OpenAI with streaming ───────────────────────────────────────────
  const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:       'gpt-4o-mini',
      stream:      true,
      max_tokens:  220,
      temperature: 0.75,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
    }),
  })

  if (!oaiRes.ok || !oaiRes.body) {
    const errText = await oaiRes.text().catch(() => 'unknown')
    console.error(`[generate-analysis] OpenAI ${oaiRes.status}: ${errText}`)
    return new Response(
      JSON.stringify({ error: `OpenAI error (${oaiRes.status})` }),
      { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // ── Pipe SSE → plain text stream ─────────────────────────────────────────
  // We extract only the delta content from each SSE line so the browser
  // receives a clean text stream it can render word-by-word.
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  ;(async () => {
    const writer = writable.getWriter()
    const reader = oaiRes.body!.getReader()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        // The last element may be an incomplete line — keep it in the buffer
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') continue
          try {
            const chunk = JSON.parse(data)
            const text: string | undefined = chunk.choices?.[0]?.delta?.content
            if (text) writer.write(encoder.encode(text))
          } catch {
            // Skip malformed / non-JSON lines
          }
        }
      }
    } finally {
      await writer.close().catch(() => {})
    }
  })()

  return new Response(readable, {
    headers: {
      ...CORS,
      'Content-Type':           'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control':          'no-store',
    },
  })
})
