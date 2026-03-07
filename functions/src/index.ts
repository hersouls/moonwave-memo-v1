import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'

// ─── Secrets ────────────────────────────────────────
const openaiKey = defineSecret('OPENAI_API_KEY')
const anthropicKey = defineSecret('ANTHROPIC_API_KEY')

// ─── Helpers ────────────────────────────────────────

function requireAuth(auth: { uid: string; token: object } | undefined): string {
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', '로그인이 필요합니다.')
  }
  return auth.uid
}

async function fetchJSON(url: string, options: RequestInit): Promise<unknown> {
  const res = await fetch(url, options)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    let message = `API error: ${res.status}`
    try {
      const parsed = JSON.parse(body)
      message = parsed?.error?.message || message
    } catch { /* use default */ }
    throw new HttpsError('internal', message)
  }
  return res.json()
}

// ─── aiChat ─────────────────────────────────────────
// Proxies text-based AI calls (tag suggestions, summarization, autocomplete)

export const aiChat = onCall(
  { secrets: [openaiKey, anthropicKey], region: 'asia-northeast3' },
  async (request) => {
    requireAuth(request.auth)

    const { prompt, systemPrompt, provider } = request.data as {
      prompt: string
      systemPrompt: string
      provider?: 'openai' | 'anthropic'
    }

    if (!prompt || !systemPrompt) {
      throw new HttpsError('invalid-argument', 'prompt and systemPrompt are required')
    }

    const oKey = openaiKey.value()
    const aKey = anthropicKey.value()
    const preferredProvider = provider || (oKey ? 'openai' : 'anthropic')

    if (preferredProvider === 'openai' && oKey) {
      const data = await fetchJSON('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${oKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      }) as { choices?: { message?: { content?: string } }[] }

      return { text: data.choices?.[0]?.message?.content?.trim() || '' }
    }

    if (aKey) {
      const data = await fetchJSON('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 500,
          system: systemPrompt,
          messages: [{ role: 'user', content: prompt }],
        }),
      }) as { content?: { type: string; text?: string }[] }

      const textBlock = data.content?.find((c) => c.type === 'text')
      return { text: textBlock?.text?.trim() || '' }
    }

    throw new HttpsError('failed-precondition', 'AI API 키가 서버에 설정되지 않았습니다.')
  }
)

// ─── imageOCR ───────────────────────────────────────
// Proxies image OCR calls (OpenAI Vision / Anthropic Vision)

export const imageOCR = onCall(
  {
    secrets: [openaiKey, anthropicKey],
    region: 'asia-northeast3',
    // Allow larger payloads for base64 images
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    requireAuth(request.auth)

    const { imageDataUrl, provider, language } = request.data as {
      imageDataUrl: string
      provider: 'openai' | 'anthropic'
      language: string
    }

    if (!imageDataUrl || !provider || !language) {
      throw new HttpsError('invalid-argument', 'imageDataUrl, provider, language are required')
    }

    const ocrPrompt = getOCRPrompt(language)

    if (provider === 'openai') {
      const key = openaiKey.value()
      if (!key) throw new HttpsError('failed-precondition', 'OpenAI API 키가 서버에 설정되지 않았습니다.')

      const data = await fetchJSON('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: ocrPrompt },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
          max_tokens: 4096,
        }),
      }) as { choices?: { message?: { content?: string } }[] }

      return { text: data.choices?.[0]?.message?.content?.trim() || '', provider: 'openai' }
    }

    // Anthropic
    const key = anthropicKey.value()
    if (!key) throw new HttpsError('failed-precondition', 'Anthropic API 키가 서버에 설정되지 않았습니다.')

    const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) throw new HttpsError('invalid-argument', '이미지 데이터 형식이 올바르지 않습니다.')

    const mediaType = match[1]
    const base64Data = match[2]

    const data = await fetchJSON('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
              { type: 'text', text: ocrPrompt },
            ],
          },
        ],
      }),
    }) as { content?: { type: string; text?: string }[] }

    return { text: data.content?.[0]?.text?.trim() || '', provider: 'anthropic' }
  }
)

// ─── speechToText ───────────────────────────────────
// Proxies Whisper STT calls

export const speechToText = onCall(
  {
    secrets: [openaiKey],
    region: 'asia-northeast3',
    memory: '512MiB',
    timeoutSeconds: 120,
  },
  async (request) => {
    requireAuth(request.auth)

    const { audioBase64, fileName, language } = request.data as {
      audioBase64: string
      fileName: string
      language: string
    }

    if (!audioBase64 || !fileName || !language) {
      throw new HttpsError('invalid-argument', 'audioBase64, fileName, language are required')
    }

    const key = openaiKey.value()
    if (!key) throw new HttpsError('failed-precondition', 'OpenAI API 키가 서버에 설정되지 않았습니다.')

    // Convert base64 to Blob for FormData
    const buffer = Buffer.from(audioBase64, 'base64')
    const blob = new Blob([buffer])

    const formData = new FormData()
    formData.append('file', blob, fileName)
    formData.append('model', 'whisper-1')
    formData.append('language', language)
    formData.append('response_format', 'verbose_json')

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
      },
      body: formData,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      let message = `Whisper API error: ${res.status}`
      try {
        const parsed = JSON.parse(body)
        message = parsed?.error?.message || message
      } catch { /* use default */ }
      throw new HttpsError('internal', message)
    }

    const data = await res.json() as {
      text?: string
      language?: string
      duration?: number
      segments?: { start: number; end: number; text: string }[]
    }

    return {
      text: data.text || '',
      language: data.language || language,
      duration: data.duration || 0,
      segments: data.segments?.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text.trim(),
      })),
    }
  }
)

// ─── Shared Prompts ─────────────────────────────────

function getOCRPrompt(language: string): string {
  switch (language) {
    case 'en':
      return 'Extract all text from this image. Preserve original formatting and line breaks as much as possible. Return only the extracted text without any explanation.'
    case 'ja':
      return 'この画像からすべてのテキストを抽出してください。元のフォーマットと改行をできるだけ維持してください。抽出されたテキストのみを返してください。'
    case 'zh':
      return '请从这张图片中提取所有文字。尽可能保持原始格式和换行。只返回提取的文字，不需要任何解释。'
    default:
      return '이 이미지에서 모든 텍스트를 추출해주세요. 원본의 서식과 줄바꿈을 최대한 유지해주세요. 추출된 텍스트만 반환해주세요.'
  }
}
