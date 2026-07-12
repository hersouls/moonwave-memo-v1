import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './lib/cors.js'

export const config = { api: { bodyParser: { sizeLimit: '25mb' } } }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { audioBase64, fileName = 'audio.webm', language = 'ko', userApiKey } = req.body || {}
  if (!audioBase64) return res.status(400).json({ error: 'Missing audioBase64' })

  const apiKey = userApiKey || process.env.OPENAI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'OpenAI API key not configured' })

  const usingServerKey = !userApiKey

  try {
    // Convert base64 to Buffer (Node.js native, no atob needed)
    const buffer = Buffer.from(audioBase64, 'base64')
    const blob = new Blob([buffer])

    const formData = new FormData()
    formData.append('file', blob, fileName)
    formData.append('model', 'whisper-1')
    formData.append('language', language)
    formData.append('response_format', 'verbose_json')

    const sttRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    })

    if (!sttRes.ok) {
      const err = await sttRes.json().catch(() => ({}))
      throw new Error(err.error?.message || `Whisper API error: ${sttRes.status}`)
    }

    const data = await sttRes.json()
    return res.status(200).json({ text: data.text || '', segments: data.segments || [], usingServerKey })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'STT failed' })
  }
}
