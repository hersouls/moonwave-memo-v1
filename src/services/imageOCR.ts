import type { OCRProvider } from '@/lib/types'
import { auth, callable } from '@/lib/firebase'

// ─── Constants ────────────────────────────────────
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']
const ALLOWED_MIME_PREFIXES = ['image/']
const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20MB

const OPENAI_CHAT_API_URL = 'https://api.openai.com/v1/chat/completions'
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

// ─── Types ────────────────────────────────────────
export interface OCRResult {
  text: string
  provider: OCRProvider
}

interface ValidationResult {
  valid: boolean
  error?: string
}

// B-03: Cloud Functions callable
const imageOCRFn = callable<
  { imageDataUrl: string; provider: OCRProvider; language: string },
  { text: string; provider: OCRProvider }
>('imageOCR')

// ─── Prompts ──────────────────────────────────────
function getOCRPrompt(language: string): string {
  switch (language) {
    case 'en':
      return 'Extract all text from this image. Preserve original formatting and line breaks as much as possible. Return only the extracted text without any explanation.'
    case 'ja':
      return 'この画像からすべてのテキストを抽出してください。元のフォーマットと改行をできるだけ維持してください。抽出されたテキストのみを返してください。'
    case 'zh':
      return '请从这张图片中提取所有文字。尽可能保持原始格式和换行。只返回提取的文字，不需要任何解释。'
    default: // ko
      return '이 이미지에서 모든 텍스트를 추출해주세요. 원본의 서식과 줄바꿈을 최대한 유지해주세요. 추출된 텍스트만 반환해주세요.'
  }
}

// ─── File Validation ──────────────────────────────
export function validateImageFile(file: File): ValidationResult {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다. 지원 형식: ${ALLOWED_EXTENSIONS.join(', ')}`,
    }
  }

  const hasValidMime = ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))
  if (file.type && !hasValidMime) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다 (${file.type})`,
    }
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `파일 크기가 20MB를 초과합니다 (${sizeMB}MB)`,
    }
  }

  return { valid: true }
}

// ─── Cloud Functions proxy ────────────────────────
async function extractTextViaProxy(
  imageDataUrl: string,
  provider: OCRProvider,
  language: string
): Promise<OCRResult | null> {
  if (!auth.currentUser) return null

  try {
    const result = await imageOCRFn({ imageDataUrl, provider, language })
    return { text: result.data.text, provider: result.data.provider }
  } catch {
    return null
  }
}

// ─── OpenAI Vision OCR (fallback) ─────────────────
async function extractTextWithOpenAI(
  imageDataUrl: string,
  apiKey: string,
  language: string,
  signal?: AbortSignal
): Promise<OCRResult> {
  let res: Response
  try {
    res = await fetch(OPENAI_CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: getOCRPrompt(language) },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
        max_tokens: 4096,
      }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('텍스트 추출이 취소되었습니다')
    }
    throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
  }

  if (!res.ok) {
    handleAPIError(res.status, 'OpenAI')
  }

  const data = await res.json()
  const text = data.choices?.[0]?.message?.content?.trim() || ''

  return { text, provider: 'openai' }
}

// ─── Anthropic Vision OCR (fallback) ──────────────
async function extractTextWithAnthropic(
  imageDataUrl: string,
  apiKey: string,
  language: string,
  signal?: AbortSignal
): Promise<OCRResult> {
  // Parse data URL -> base64 + media type
  const match = imageDataUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/)
  if (!match) {
    throw new Error('이미지 데이터 형식이 올바르지 않습니다')
  }
  const rawMediaType = match[1]
  const allowedMediaTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
  if (!allowedMediaTypes.includes(rawMediaType as typeof allowedMediaTypes[number])) {
    throw new Error(`지원하지 않는 이미지 형식입니다: ${rawMediaType}`)
  }
  const mediaType = rawMediaType as typeof allowedMediaTypes[number]
  const base64Data = match[2]

  let res: Response
  try {
    res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250514',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              { type: 'text', text: getOCRPrompt(language) },
            ],
          },
        ],
      }),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('텍스트 추출이 취소되었습니다')
    }
    throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
  }

  if (!res.ok) {
    handleAPIError(res.status, 'Anthropic')
  }

  const data = await res.json()
  const text = data.content?.[0]?.text?.trim() || ''

  return { text, provider: 'anthropic' }
}

// ─── Error Handler ────────────────────────────────
function handleAPIError(status: number, provider: string): never {
  if (status === 401) {
    throw new Error(`${provider} API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.`)
  }
  if (status === 429) {
    throw new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
  }
  if (status === 413) {
    throw new Error('이미지 크기가 너무 큽니다.')
  }
  throw new Error('텍스트 추출 중 오류가 발생했습니다')
}

// ─── Unified API: proxy first, then direct fallback ──
export async function extractTextFromImage(
  imageDataUrl: string,
  provider: OCRProvider,
  apiKey: string,
  language: string,
  signal?: AbortSignal
): Promise<OCRResult> {
  // Try Cloud Functions proxy first (secure)
  const proxyResult = await extractTextViaProxy(imageDataUrl, provider, language)
  if (proxyResult) return proxyResult

  // Fallback to direct API calls with user-provided key
  if (provider === 'anthropic') {
    return extractTextWithAnthropic(imageDataUrl, apiKey, language, signal)
  }
  return extractTextWithOpenAI(imageDataUrl, apiKey, language, signal)
}
