import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './lib/cors.js'
import { guardAiRequest, POLICIES } from './lib/guard.js'
import { providerError, sendUpstreamError } from './lib/upstream.js'

type Provider = 'openai' | 'anthropic' | 'gemini'

/** Fixed server-side output ceiling (never taken from the client). */
const OCR_MAX_TOKENS = 4096

interface OpenAIChatResponse { choices?: Array<{ message?: { content?: string } }> }
interface AnthropicResponse { content?: Array<{ type: string; text?: string }> }
interface GeminiResponse { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }

/**
 * Accept only an inline base64 image data URL. (A remote http(s) URL would make the
 * provider fetch arbitrary URLs on our key.) Returns null when malformed.
 */
function parseImageDataUrl(dataUrl: string): { mimeType: string; base64: string } | null {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(dataUrl.slice(0, 64))
  if (!match) return null
  const base64 = dataUrl.slice(match[0].length)
  if (!base64) return null
  return { mimeType: match[1].toLowerCase(), base64 }
}

function getOCRPrompt(language: string): string {
  const langMap: Record<string, string> = {
    ko: '한국어', en: 'English', ja: '日本語', zh: '中文',
  }
  const lang = langMap[language] || '한국어'
  return `이미지에서 텍스트를 추출해 주세요. 텍스트가 있으면 원본 형식을 최대한 유지하며 ${lang}로 응답해 주세요. 텍스트가 없으면 이미지를 설명해 주세요.`
}

async function ocrOpenAI(apiKey: string, imageDataUrl: string, prompt: string) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
        ],
      }],
      max_tokens: OCR_MAX_TOKENS,
    }),
  })
  if (!res.ok) throw await providerError('openai', res)
  const data = (await res.json()) as OpenAIChatResponse
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function ocrAnthropic(apiKey: string, image: { mimeType: string; base64: string }, prompt: string) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: OCR_MAX_TOKENS,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mimeType, data: image.base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })
  if (!res.ok) throw await providerError('anthropic', res)
  const data = (await res.json()) as AnthropicResponse
  return data.content?.find((c) => c.type === 'text')?.text?.trim() || ''
}

async function ocrGemini(apiKey: string, image: { mimeType: string; base64: string }, prompt: string) {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
          ],
        }],
        generationConfig: { maxOutputTokens: OCR_MAX_TOKENS },
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

  // Auth (401/403), string/provider checks (400), image size cap (413), per-uid limits (429).
  if (!(await guardAiRequest(req, res, POLICIES.ocr))) return

  const { imageDataUrl, language = 'ko', userApiKey } = req.body || {}
  const provider: Provider = req.body?.provider ?? 'openai'
  if (!imageDataUrl) return res.status(400).json({ error: 'Missing imageDataUrl' })
  const image = parseImageDataUrl(imageDataUrl)
  if (!image) return res.status(400).json({ error: 'imageDataUrl must be a base64 image data URL' })

  const apiKey = userApiKey || getServerKey(provider)
  if (!apiKey) return res.status(500).json({ error: `${provider} API key not configured` })

  const prompt = getOCRPrompt(language)
  const usingServerKey = !userApiKey

  try {
    let text: string
    switch (provider) {
      case 'anthropic': text = await ocrAnthropic(apiKey, image, prompt); break
      case 'gemini': text = await ocrGemini(apiKey, image, prompt); break
      default: text = await ocrOpenAI(apiKey, imageDataUrl, prompt)
    }
    return res.status(200).json({ text, usingServerKey })
  } catch (err) {
    return sendUpstreamError(res, 'ocr', err, usingServerKey)
  }
}
