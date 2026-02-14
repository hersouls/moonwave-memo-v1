/**
 * Vercel Edge Function — AI Proxy
 * Forwards requests to Anthropic API using server-side API key.
 *
 * Environment variable: ANTHROPIC_API_KEY
 * Endpoint: POST /api/ai/proxy
 */

export const config = { runtime: 'edge' }

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const serverApiKey = process.env.ANTHROPIC_API_KEY
  if (!serverApiKey) {
    return new Response(
      JSON.stringify({ error: 'Server API key not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  try {
    const body = await request.json()

    // Validate required fields
    if (!body.model || !body.messages) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: model, messages' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }

    // Enforce max_tokens limit
    const maxTokens = Math.min(body.max_tokens || 1024, 2048)

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': serverApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: body.model,
        max_tokens: maxTokens,
        system: body.system,
        messages: body.messages,
      }),
    })

    const data = await response.text()
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'Proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}
