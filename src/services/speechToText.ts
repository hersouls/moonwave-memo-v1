import { auth, callable } from '@/lib/firebase'
import { authedFetch, apiErrorMessage, AuthRequiredError } from '@/lib/apiBase'

// ─── Constants ────────────────────────────────────
const ALLOWED_EXTENSIONS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg']
const ALLOWED_MIME_PREFIXES = ['audio/', 'video/mp4']
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB (direct/personal-key path)
// The keyless Vercel proxy path is bounded by Vercel's ~4.5MB request-body limit; base64
// adds ~33%, so the raw file must stay under ~3.3MB to avoid a pre-handler 413.
const VERCEL_PROXY_MAX_BYTES = 3.3 * 1024 * 1024
const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions'

// ─── Types ────────────────────────────────────────
export interface TranscriptionSegment {
  start: number
  end: number
  text: string
}

export interface STTResult {
  text: string
  language: string
  duration: number
  segments?: TranscriptionSegment[]
}

interface ValidationResult {
  valid: boolean
  error?: string
}

// B-03: Cloud Functions callable
const speechToTextFn = callable<
  { audioBase64: string; fileName: string; language: string },
  STTResult
>('speechToText')

// ─── File Validation ──────────────────────────────
export function validateAudioFile(file: File): ValidationResult {
  // Check extension
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식이에요. 쓸 수 있는 형식: ${ALLOWED_EXTENSIONS.join(', ')}`,
    }
  }

  // Check MIME type (loose check — some browsers report different types)
  const hasValidMime = ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))
  if (file.type && !hasValidMime) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식이에요 (${file.type})`,
    }
  }

  // Check size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `25MB가 넘는 파일은 올릴 수 없어요 (지금 파일: ${sizeMB}MB)`,
    }
  }

  return { valid: true }
}

// ─── Helper: File → base64 ───────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip the data URL prefix to get pure base64
      const base64 = dataUrl.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ─── Cloud Functions proxy ────────────────────────
async function transcribeViaProxy(
  file: File,
  language: string
): Promise<STTResult | null> {
  if (!auth.currentUser) return null

  try {
    const audioBase64 = await fileToBase64(file)
    const result = await speechToTextFn({
      audioBase64,
      fileName: file.name,
      language,
    })
    return result.data
  } catch {
    return null
  }
}

// ─── Transcription: proxy first, then direct fallback ──
export async function transcribeAudio(
  file: File,
  apiKey: string,
  language: string,
  signal?: AbortSignal
): Promise<STTResult> {
  // Try Cloud Functions proxy first (secure)
  const proxyResult = await transcribeViaProxy(file, language)
  if (proxyResult) return proxyResult

  // Try Vercel API proxy (server keys)
  if (!apiKey) {
    // Vercel caps request bodies at ~4.5MB and base64 inflates the file by ~33%, so
    // anything over ~3.3MB is rejected with 413 before our function even runs. Fail
    // early with an actionable message instead of the generic "unavailable" below.
    if (file.size > VERCEL_PROXY_MAX_BYTES) {
      throw new Error('서버로 올릴 수 있는 크기(약 3MB)를 넘는 파일이에요. 설정에서 OpenAI API 키를 등록하면 더 큰 파일도 받아 적을 수 있어요.')
    }
    let proxyRes: Response | null = null
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = () => reject(new Error('파일을 읽지 못했어요'))
        reader.readAsDataURL(file)
      })
      proxyRes = await authedFetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64: base64, fileName: file.name, language }),
        signal,
      })
    } catch (err) {
      // Signed out: the server path needs a login — say so (no request was sent).
      if (err instanceof AuthRequiredError) throw err
      /* network error → fall through to direct path */
    }
    if (proxyRes?.ok) {
      const data = await proxyRes.json()
      return { text: data.text || '', language, duration: 0, segments: data.segments || [] }
    }
    if (proxyRes?.status === 413) {
      throw new Error('서버로 올릴 수 있는 크기를 넘는 파일이에요. 설정에서 OpenAI API 키를 등록하면 더 큰 파일도 받아 적을 수 있어요.')
    }
    if (proxyRes && [401, 403, 429].includes(proxyRes.status)) {
      throw new Error(await apiErrorMessage(proxyRes))
    }
  }

  // Fallback to direct API call with user-provided key
  if (!apiKey) throw new Error('음성 인식을 쓸 수 없어요. 잠시 후 다시 시도해 주세요.')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('model', 'whisper-1')
  formData.append('language', language)
  formData.append('response_format', 'verbose_json')

  let res: Response
  try {
    res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('받아 적기를 취소했어요')
    }
    throw new Error('연결하지 못했어요. 인터넷 연결을 확인해 주세요.')
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('API 키가 올바르지 않아요. 설정에서 API 키를 확인해 주세요.')
    }
    if (res.status === 413) {
      throw new Error('파일이 너무 커요. 더 작은 파일로 다시 시도해 주세요.')
    }
    if (res.status === 429) {
      throw new Error('API 요청 한도를 넘었어요. 잠시 후 다시 시도해 주세요.')
    }

    let errorMsg = '음성을 받아 적지 못했어요. 다시 시도해 주세요'
    try {
      const errBody = await res.json()
      if (errBody?.error?.message) {
        errorMsg = errBody.error.message
      }
    } catch {
      // ignore parse error
    }
    throw new Error(errorMsg)
  }

  const data = await res.json()

  return {
    text: data.text || '',
    language: data.language || language,
    duration: data.duration || 0,
    segments: data.segments?.map((s: { start: number; end: number; text: string }) => ({
      start: s.start,
      end: s.end,
      text: s.text.trim(),
    })),
  }
}

// ─── Formatting ───────────────────────────────────
function formatTime(seconds: number): string {
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function formatTranscription(result: STTResult, includeTimestamps: boolean): string {
  if (!includeTimestamps || !result.segments?.length) {
    return result.text
  }

  return result.segments
    .map((seg) => `[${formatTime(seg.start)}] ${seg.text}`)
    .join('\n')
}
