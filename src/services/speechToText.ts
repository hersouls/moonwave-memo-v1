import { auth, callable } from '@/lib/firebase'

// ─── Constants ────────────────────────────────────
const ALLOWED_EXTENSIONS = ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm', 'ogg']
const ALLOWED_MIME_PREFIXES = ['audio/', 'video/mp4']
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
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
      error: `지원하지 않는 파일 형식입니다. 지원 형식: ${ALLOWED_EXTENSIONS.join(', ')}`,
    }
  }

  // Check MIME type (loose check — some browsers report different types)
  const hasValidMime = ALLOWED_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))
  if (file.type && !hasValidMime) {
    return {
      valid: false,
      error: `지원하지 않는 파일 형식입니다 (${file.type})`,
    }
  }

  // Check size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return {
      valid: false,
      error: `파일 크기가 25MB를 초과합니다 (${sizeMB}MB)`,
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

  // Fallback to direct API call with user-provided key
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
      throw new Error('변환이 취소되었습니다')
    }
    throw new Error('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해주세요.')
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('API 키가 유효하지 않습니다. 설정에서 API 키를 확인해주세요.')
    }
    if (res.status === 413) {
      throw new Error('파일 크기가 너무 큽니다.')
    }
    if (res.status === 429) {
      throw new Error('API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.')
    }

    let errorMsg = '음성 변환 중 오류가 발생했습니다'
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
