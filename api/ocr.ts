import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './lib/cors'

type Provider = 'openai' | 'anthropic' | 'gemini'

function parseDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const commaIdx = dataUrl.indexOf(',')
  if (commaIdx === -1) throw new Error('Invalid data URL format')
  const meta = dataUrl.substring(0, commaIdx)
  const base64 = dataUrl.substring(commaIdx + 1)
  if (!base64) throw new Error('Empty image data')
  const mimeType = meta.match(/data:(.*?);/)?.[1] || 'image/png'
  return { mimeType, base64 }
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
      max_tokens: 4096,
    }),
  })
  if (!res.ok) throw new Error(`OpenAI OCR error: ${res.status}`)
  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ''
}

async function ocrAnthropic(apiKey: string, imageDataUrl: string, prompt: string) {
  const { mimeType, base64 } = parseDataUrl(imageDataUrl)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic OCR error: ${res.status}`)
  const data = await res.json()
  return data.content?.find((c: { type: string }) => c.type === 'text')?.text?.trim() || ''
}

async function ocrGemini(apiKey: string, imageDataUrl: string, prompt: string) {
  const { mimeType, base64 } = parseDataUrl(imageDataUrl)
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: base64 } },
          ],
        }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    }
  )
  if (!res.ok) throw new Error(`Gemini OCR error: ${res.status}`)
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

  const { imageDataUrl, provider = 'openai', language = 'ko', userApiKey } = req.body || {}
  if (!imageDataUrl) return res.status(400).json({ error: 'Missing imageDataUrl' })

  const apiKey = userApiKey || getServerKey(provider as Provider)
  if (!apiKey) return res.status(500).json({ error: `${provider} API key not configured` })

  const prompt = getOCRPrompt(language)
  const usingServerKey = !userApiKey

  try {
    let text: string
    switch (provider) {
      case 'anthropic': text = await ocrAnthropic(apiKey, imageDataUrl, prompt); break
      case 'gemini': text = await ocrGemini(apiKey, imageDataUrl, prompt); break
      default: text = await ocrOpenAI(apiKey, imageDataUrl, prompt)
    }
    return res.status(200).json({ text, usingServerKey })
  } catch (err) {
    return res.status(502).json({ error: err instanceof Error ? err.message : 'OCR failed' })
  }
}
