import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './lib/cors.js'

const MODELS = {
  openai: 'gpt-4.1-nano',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-2.5-flash',
} as const

type Provider = 'openai' | 'anthropic' | 'gemini'

async function callOpenAI(apiKey: string, prompt: string, systemPrompt: string, maxTokens: number) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: MODELS.openai,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`)
  }
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function callAnthropic(apiKey: string, prompt: string, systemPrompt: string, maxTokens: number) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODELS.anthropic,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Anthropic API error: ${res.status}`)
  }
  const data = await res.json()
  const textBlock = data.content?.find((c: { type: string }) => c.type === 'text')
  return textBlock?.text?.trim() || ''
}

async function callGemini(apiKey: string, prompt: string, systemPrompt: string, maxTokens: number) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        // Gemini 2.5 uses thinking tokens; multiply to compensate
        generationConfig: { maxOutputTokens: maxTokens * 4, temperature: 0.3 },
      }),
    }
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error?.message || `Gemini API error: ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
}

function getServerKey(provider: Provider): string | undefined {
  switch (provider) {
    case 'openai': return process.env.OPENAI_API_KEY
    case 'anthropic': return process.env.ANTHROPIC_API_KEY
    case 'gemini': return process.env.GEMINI_API_KEY
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { prompt, systemPrompt, provider = 'openai', userApiKey } = req.body || {}
  if (!prompt || !systemPrompt) return res.status(400).json({ error: 'Missing prompt or systemPrompt' })

  // Clamp maxTokens server-side — never trust the client value. Unbounded max_tokens on
  // the operator's server key is a direct cost-amplification vector; the app's features
  // never need more than ~2000 completion tokens.
  const rawMax = Number(req.body?.maxTokens)
  const maxTokens = Number.isFinite(rawMax) ? Math.min(Math.max(Math.trunc(rawMax), 1), 2000) : 500

  const apiKey = userApiKey || getServerKey(provider as Provider)
  if (!apiKey) return res.status(500).json({ error: `${provider} API key not configured` })

  // If using server key (no userApiKey), this counts toward daily limit
  const usingServerKey = !userApiKey

  try {
    let text: string
    switch (provider) {
      case 'anthropic':
        text = await callAnthropic(apiKey, prompt, systemPrompt, maxTokens)
        break
      case 'gemini':
        text = await callGemini(apiKey, prompt, systemPrompt, maxTokens)
        break
      default:
        text = await callOpenAI(apiKey, prompt, systemPrompt, maxTokens)
    }
    return res.status(200).json({ text, usingServerKey })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[AI API Error]', message)
    // Relay the upstream error only for a caller's OWN key; when the server key was used,
    // return a generic message so key fragments / billing state don't leak to anonymous
    // callers.
    return res.status(502).json({ error: usingServerKey ? 'AI 서비스 요청에 실패했습니다.' : message })
  }
}
