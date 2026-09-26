import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticate, type VerifiedUser, type VerifyOptions } from './auth.js'
import { rateLimiter, type RateBucket, type RateWindow } from './rateLimit.js'

/**
 * Gate for every route that spends money on a paid AI provider:
 *   1. Firebase ID token (+ optional AI_ALLOWED_UIDS allowlist) → 401 / 403
 *   2. basic input shape (string fields, known provider)         → 400
 *   3. hard input-size caps                                       → 413
 *   4. per-uid rate limits (per route family + global ceiling)    → 429 + Retry-After
 * Checks run in that order, so malformed/oversized requests never consume quota.
 */

const MIN = 60_000
const DAY = 24 * 60 * MIN

/** Default for LLM routes: 30 per 5 min and 300 per rolling 24 h, per uid, per family. */
export const STANDARD_LIMITS: readonly RateWindow[] = [
  { windowMs: 5 * MIN, max: 30 },
  { windowMs: DAY, max: 300 },
]
/** Vision / speech: large uploads to expensive models (GPT-4o image, Whisper). */
const MEDIA_LIMITS: readonly RateWindow[] = [
  { windowMs: 5 * MIN, max: 10 },
  { windowMs: DAY, max: 50 },
]
/** Autocomplete fires on every typing pause (1.5 s debounce, ≤100 output tokens). */
const AUTOCOMPLETE_LIMITS: readonly RateWindow[] = [
  { windowMs: 5 * MIN, max: 60 },
  { windowMs: DAY, max: 600 },
]
/** Embeddings are cheap but bursty — the knowledge graph embeds every memo on first open. */
const EMBEDDING_LIMITS: readonly RateWindow[] = [
  { windowMs: 5 * MIN, max: 400 },
  { windowMs: DAY, max: 3000 },
]
/** Per-uid ceiling across ALL families (except embeddings) so 14 routes can't be stacked. */
export const GLOBAL_LIMITS: readonly RateWindow[] = [
  { windowMs: 5 * MIN, max: 120 },
  { windowMs: DAY, max: 1000 },
]

export interface RoutePolicy {
  /** Rate-limit bucket name. */
  family: string
  /** Cap on the whole JSON body, measured by `measureInput` (≈ characters). */
  maxInputChars: number
  /** Per-field caps (top-level body fields), same measure. */
  fieldCaps?: Readonly<Record<string, number>>
  /** Top-level fields that must be strings when present (they reach a prompt verbatim). */
  stringFields?: readonly string[]
  limits?: readonly RateWindow[]
  /** Counted toward GLOBAL_LIMITS (default true). */
  global?: boolean
}

const TEXT_ROUTE = (family: string, maxInputChars: number, stringFields: readonly string[] = ['content']): RoutePolicy => ({
  family,
  maxInputChars,
  stringFields,
})

// Caps sit comfortably above what the app itself sends (see src/services/*), so only
// hand-crafted requests are rejected. Servers still slice what reaches the model.
export const POLICIES = {
  ai: TEXT_ROUTE('ai', 20_000, ['prompt', 'systemPrompt']),
  ocr: {
    family: 'ocr',
    maxInputChars: 3_600_000,
    fieldCaps: { imageDataUrl: 3_500_000 }, // data URL ≈ 2.6 MB image (client caps at ~3.3M chars)
    stringFields: ['imageDataUrl', 'language'],
    limits: MEDIA_LIMITS,
  },
  stt: {
    family: 'stt',
    maxInputChars: 4_700_000,
    fieldCaps: { audioBase64: 4_650_000 }, // base64 ≈ 3.4 MB audio (client caps at 3.3 MB)
    stringFields: ['audioBase64', 'fileName', 'language'],
    limits: MEDIA_LIMITS,
  },
  analyze: TEXT_ROUTE('langchain:analyze', 20_000),
  autocomplete: { ...TEXT_ROUTE('langchain:autocomplete', 4_000, ['cursorContext']), limits: AUTOCOMPLETE_LIMITS },
  briefing: TEXT_ROUTE('langchain:briefing', 20_000, []),
  classify: TEXT_ROUTE('langchain:classify', 20_000),
  demian: TEXT_ROUTE('langchain:demian', 60_000, ['currentBody']),
  digest: TEXT_ROUTE('langchain:digest', 30_000, []),
  embedding: {
    family: 'langchain:embedding',
    maxInputChars: 8_000,
    stringFields: ['text'],
    limits: EMBEDDING_LIMITS,
    global: false,
  },
  insights: TEXT_ROUTE('langchain:insights', 30_000, []),
  readability: TEXT_ROUTE('langchain:readability', 20_000),
  // memoSummaries may carry 1536-dim embeddings (each number counts 1).
  search: { ...TEXT_ROUTE('langchain:search', 400_000, ['query']), fieldCaps: { query: 1_000 } },
  stream: TEXT_ROUTE('langchain:stream', 20_000, ['content', 'task']),
  summarize: TEXT_ROUTE('langchain:summarize', 20_000),
  tags: TEXT_ROUTE('langchain:tags', 20_000),
} satisfies Record<string, RoutePolicy>

const PROVIDERS = new Set(['openai', 'anthropic', 'gemini'])

/**
 * Size of an arbitrary JSON value ≈ total characters: string length, 1 per other scalar,
 * key lengths for objects. Iterative (no recursion-depth blowup) and stops as soon as
 * `stopAbove` is exceeded.
 */
export function measureInput(value: unknown, stopAbove = Number.POSITIVE_INFINITY): number {
  let total = 0
  const stack: unknown[] = [value]
  while (stack.length > 0 && total <= stopAbove) {
    const v = stack.pop()
    if (typeof v === 'string') total += v.length
    else if (Array.isArray(v)) {
      total += 1
      for (const item of v) stack.push(item)
    } else if (v !== null && typeof v === 'object') {
      for (const [k, item] of Object.entries(v)) {
        total += k.length
        stack.push(item)
      }
    } else if (v !== undefined) total += 1
  }
  return total
}

function reject(res: VercelResponse, status: number, error: string, message: string): null {
  res.status(status).json({ error, message })
  return null
}

function bucketsFor(policy: RoutePolicy, uid: string): RateBucket[] {
  const buckets: RateBucket[] = [{ key: `${policy.family}:${uid}`, windows: policy.limits ?? STANDARD_LIMITS }]
  if (policy.global !== false) buckets.push({ key: `*:${uid}`, windows: GLOBAL_LIMITS })
  return buckets
}

function formatWait(sec: number): string {
  if (sec < 60) return `${sec}초`
  if (sec < 3600) return `${Math.ceil(sec / 60)}분`
  return `${Math.ceil(sec / 3600)}시간`
}

/**
 * Run the full gate. Returns the verified user, or null after having written the error
 * response (the caller must return immediately).
 */
export async function guardAiRequest(
  req: VercelRequest,
  res: VercelResponse,
  policy: RoutePolicy,
  verify?: VerifyOptions,
): Promise<VerifiedUser | null> {
  const user = await authenticate(req, res, verify)
  if (!user) return null

  const body: Record<string, unknown> = req.body !== null && typeof req.body === 'object' ? req.body : {}

  for (const field of [...(policy.stringFields ?? []), 'provider', 'userApiKey']) {
    const v = body[field]
    if (v !== undefined && v !== null && typeof v !== 'string') {
      return reject(res, 400, 'invalid_input', `${field} 형식이 올바르지 않습니다.`)
    }
  }
  if (body.provider != null && !PROVIDERS.has(body.provider as string)) {
    return reject(res, 400, 'invalid_input', '지원하지 않는 AI 제공자입니다.')
  }

  for (const [field, cap] of Object.entries(policy.fieldCaps ?? {})) {
    if (measureInput(body[field], cap) > cap) {
      return reject(res, 413, 'payload_too_large', `입력이 너무 큽니다 (${field} 최대 ${cap.toLocaleString('en-US')}자).`)
    }
  }
  if (measureInput(req.body, policy.maxInputChars) > policy.maxInputChars) {
    return reject(res, 413, 'payload_too_large', `입력이 너무 큽니다 (최대 ${policy.maxInputChars.toLocaleString('en-US')}자).`)
  }

  const decision = rateLimiter.hit(bucketsFor(policy, user.uid))
  if (!decision.allowed) {
    res.setHeader('Retry-After', String(decision.retryAfterSec))
    res.status(429).json({
      error: 'rate_limited',
      message: `AI 요청이 너무 많습니다. ${formatWait(decision.retryAfterSec)} 후 다시 시도해 주세요.`,
      retryAfter: decision.retryAfterSec,
    })
    return null
  }

  return user
}
