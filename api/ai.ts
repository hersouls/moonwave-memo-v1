import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './lib/cors.js'
import { guardAiRequest, POLICIES } from './lib/guard.js'
import { providerError, sendUpstreamError } from './lib/upstream.js'

const MODELS = {
  openai: 'gpt-4.1-nano',
  anthropic: 'claude-sonnet-4-6',
  gemini: 'gemini-2.5-flash',
} as const

type Provider = 'openai' | 'anthropic' | 'gemini'

/** Hard ceiling on completion tokens — the client value is never trusted. */
const MAX_TOKENS_CAP = 2000
const DEFAULT_MAX_TOKENS = 500

interface OpenAIChatResponse { choices?: Array<{ message?: { content?: string } }> }
interface AnthropicResponse { content?: Array<{ type: string; text?: string }> }
interface GeminiResponse { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }

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
  if (!res.ok) throw await providerError('openai', res)
  const data = (await res.json()) as OpenAIChatResponse
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
  if (!res.ok) throw await providerError('anthropic', res)
  const data = (await res.json()) as AnthropicResponse
  const textBlock = data.content?.find((c) => c.type === 'text')
  return textBlock?.text?.trim() || ''
}

async function callGemini(apiKey: string, prompt: string, systemPrompt: string, maxTokens: number) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.gemini}:generateContent`,
    {
      method: 'POST',
      // Key in a header, not the URL — URLs end up in logs and error messages.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        // Gemini 2.5 uses thinking tokens; multiply to compensate
        generationConfig: { maxOutputTokens: maxTokens * 4, temperature: 0.3 },
      }),
    }
  )
  if (!res.ok) throw await providerError('gemini', res)
  const data = (await res.json()) as GeminiResponse
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

  // Auth (401/403), string/provider checks (400), size caps (413), per-uid limits (429).
  if (!(await guardAiRequest(req, res, POLICIES.ai))) return

  const { prompt, systemPrompt, userApiKey } = req.body || {}
  const provider: Provider = req.body?.provider ?? 'openai'
  if (!prompt || !systemPrompt) return res.status(400).json({ error: 'Missing prompt or systemPrompt' })

  // Clamp maxTokens server-side — never trust the client value. Unbounded max_tokens on
  // the operator's server key is a direct cost-amplification vector; the app's features
  // never need more than ~2000 completion tokens.
  const rawMax = Number(req.body?.maxTokens)
  const maxTokens = Number.isFinite(rawMax)
    ? Math.min(Math.max(Math.trunc(rawMax), 1), MAX_TOKENS_CAP)
    : DEFAULT_MAX_TOKENS

  const apiKey = userApiKey || getServerKey(provider)
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
    return sendUpstreamError(res, 'ai', err, usingServerKey)
  }
}
