import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './lib/cors.js'
import { guardAiRequest, POLICIES } from './lib/guard.js'
import { providerError, sendUpstreamError } from './lib/upstream.js'

// NOTE: `api.bodyParser.sizeLimit` is a Next.js pages/api convention and is IGNORED by
// @vercel/node functions — Vercel enforces a hard ~4.5MB request-body limit regardless.
// The client (speechToText.ts) guards against oversized uploads before POSTing here, and
// POLICIES.stt caps the base64 payload (413) before any provider call.

const AUDIO_EXTENSIONS = new Set(['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg'])

interface WhisperResponse { text?: string; segments?: unknown[] }

/** Only a short name with a Whisper-supported extension is forwarded. */
function safeFileName(name: unknown): string {
  if (typeof name !== 'string' || name.length > 200) return 'audio.webm'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return AUDIO_EXTENSIONS.has(ext) ? `audio.${ext}` : 'audio.webm'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth (401/403), string checks (400), audio size cap (413), per-uid limits (429).
  if (!(await guardAiRequest(req, res, POLICIES.stt))) return

  const { audioBase64, fileName, language, userApiKey } = req.body || {}
  if (!audioBase64) return res.status(400).json({ error: 'Missing audioBase64' })
  const lang = typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : 'ko'

  const apiKey = userApiKey || process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' })

  const usingServerKey = !userApiKey

  try {
    // Convert base64 to Buffer (Node.js native, no atob needed)
    const buffer = Buffer.from(audioBase64, 'base64')
    if (buffer.length === 0) return res.status(400).json({ error: 'Empty audio' })
    const blob = new Blob([buffer])

    const formData = new FormData()
    formData.append('file', blob, safeFileName(fileName))
    formData.append('model', 'whisper-1')
    formData.append('language', lang)
    formData.append('response_format', 'verbose_json')

    const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!sttRes.ok) throw await providerError('openai', sttRes)

    const data = (await sttRes.json()) as WhisperResponse
    return res.status(200).json({ text: data.text || '', segments: data.segments || [], usingServerKey })
  } catch (err) {
    return sendUpstreamError(res, 'stt', err, usingServerKey)
  }
}
