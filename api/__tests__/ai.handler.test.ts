import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import handler from '../ai.js'
import { rateLimiter } from '../lib/rateLimit.js'
import { GOOGLE_JWKS_URL, makeKeys, mintToken, type TestKeys } from './firebaseTokens.js'
import { callHandler } from './harness.js'

// The handler runs unmodified: Google's JWKS and OpenAI are served by a stubbed global
// fetch, so this exercises the real remote-JWKS path, the guard and the provider call.

function call(opts: { token?: string; body?: unknown; method?: string; headers?: Record<string, string> } = {}) {
  return callHandler(handler, { ...opts, body: opts.body ?? { prompt: 'hello', systemPrompt: 'be brief' } })
}

let keys: TestKeys
let otherKeys: TestKeys
let token: string
let openaiResponse: () => Response
const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url === GOOGLE_JWKS_URL) return new Response(JSON.stringify(keys.jwks), { status: 200 })
  if (url.startsWith('https://api.openai.com/')) return openaiResponse()
  throw new Error(`unexpected fetch ${url}`)
})
const openaiCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith('https://api.openai.com/'))

beforeAll(async () => {
  keys = await makeKeys('kid-ai')
  otherKeys = await makeKeys('kid-ai')
  token = await mintToken(keys, { sub: 'uid-alice' })
})

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  rateLimiter.clear()
  delete process.env.AI_ALLOWED_UIDS
  process.env.OPENAI_API_KEY = 'sk-server-test-key-000000'
  openaiResponse = () => new Response(JSON.stringify({ choices: [{ message: { content: ' hi there ' } }] }), { status: 200 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('api/ai auth', () => {
  it('200 with a valid Firebase ID token', async () => {
    const res = await call({ token })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: 'hi there', usingServerKey: true })
    expect(openaiCalls()).toHaveLength(1)
  })

  it('401 {error:"unauthorized"} without a token — provider never called', async () => {
    const res = await call()
    expect(res.statusCode).toBe(401)
    expect(res.body).toEqual({ error: 'unauthorized' })
    expect(res.headers['www-authenticate']).toBe('Bearer')
    expect(openaiCalls()).toHaveLength(0)
  })

  it('401 for a forged / expired / wrong-project token', async () => {
    const now = Math.floor(Date.now() / 1000)
    for (const bad of [
      await mintToken(otherKeys, { sub: 'uid-alice' }),
      await mintToken(keys, { exp: now - 3600, iat: now - 7200 }),
      await mintToken(keys, { aud: 'other-project', iss: 'https://securetoken.google.com/other-project' }),
      'Bearer-garbage',
    ]) {
      const res = await call({ token: bad })
      expect(res.statusCode).toBe(401)
      expect(res.body).toEqual({ error: 'unauthorized' })
    }
    expect(openaiCalls()).toHaveLength(0)
  })

  it('403 when AI_ALLOWED_UIDS is set and the uid is not listed; 200 when listed', async () => {
    process.env.AI_ALLOWED_UIDS = 'uid-bob, uid-carol'
    const denied = await call({ token })
    expect(denied.statusCode).toBe(403)
    expect(denied.body).toEqual({ error: 'forbidden' })
    expect(openaiCalls()).toHaveLength(0)

    process.env.AI_ALLOWED_UIDS = 'uid-bob,uid-alice'
    expect((await call({ token })).statusCode).toBe(200)
  })

  it('answers the APK CORS preflight (allowing Authorization) without auth', async () => {
    const res = await call({ method: 'OPTIONS', headers: { origin: 'https://localhost' } })
    expect(res.statusCode).toBe(204)
    expect(res.headers['access-control-allow-headers']).toMatch(/Authorization/)
  })
})

describe('api/ai input caps', () => {
  it('413 for a prompt over 20,000 chars — no provider call, no quota consumed', async () => {
    const res = await call({ token, body: { prompt: 'x'.repeat(20_001), systemPrompt: 's' } })
    expect(res.statusCode).toBe(413)
    expect(res.body).toMatchObject({ error: 'payload_too_large' })
    expect(openaiCalls()).toHaveLength(0)
    for (let i = 0; i < 30; i++) expect((await call({ token })).statusCode).toBe(200)
  })

  it('400 when prompt is not a string (e.g. multimodal content blocks)', async () => {
    const body = { prompt: [{ type: 'image_url', image_url: { url: 'https://example.com/a.png' } }], systemPrompt: 's' }
    const res = await call({ token, body })
    expect(res.statusCode).toBe(400)
    expect(openaiCalls()).toHaveLength(0)
  })

  it('400 for an unknown provider', async () => {
    const res = await call({ token, body: { prompt: 'p', systemPrompt: 's', provider: 'evil' } })
    expect(res.statusCode).toBe(400)
  })

  it('clamps maxTokens server-side', async () => {
    await call({ token, body: { prompt: 'p', systemPrompt: 's', maxTokens: 999_999 } })
    const sent = JSON.parse(String((openaiCalls()[0][1] as RequestInit).body))
    expect(sent.max_tokens).toBe(2000)
  })
})

describe('api/ai rate limit', () => {
  it('429 with Retry-After after 30 requests in 5 minutes (per uid)', async () => {
    for (let i = 0; i < 30; i++) expect((await call({ token })).statusCode).toBe(200)
    const res = await call({ token })
    expect(res.statusCode).toBe(429)
    expect(res.body).toMatchObject({ error: 'rate_limited' })
    const retryAfter = Number(res.headers['retry-after'])
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(300)
    expect(openaiCalls()).toHaveLength(30)

    // another user is unaffected
    const bob = await mintToken(keys, { sub: 'uid-bob' })
    expect((await call({ token: bob })).statusCode).toBe(200)
  })

  it('429 after 300 requests in a rolling day even when spread over 5-minute windows', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const start = Date.now()
    vi.setSystemTime(start)
    const dayToken = await mintToken(keys, { sub: 'uid-daily' })
    for (let block = 0; block < 10; block++) {
      vi.setSystemTime(start + block * 5 * 60_000 + block)
      for (let i = 0; i < 30; i++) expect((await call({ token: dayToken })).statusCode).toBe(200)
    }
    vi.setSystemTime(start + 10 * 5 * 60_000 + 10)
    const res = await call({ token: dayToken })
    expect(res.statusCode).toBe(429)
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(20 * 3600)
  })
})

describe('api/ai provider errors', () => {
  // Built at runtime so the repo's secret scanner doesn't see a key-shaped literal.
  const leakedKey = ['sk', 'proj', 'abcd1234secret'].join('-')

  it('returns a generic 502 and logs a redacted error — never the provider body', async () => {
    const logged: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(' ')) })
    openaiResponse = () => new Response(
      JSON.stringify({ error: { message: `Incorrect API key provided: ${leakedKey}. org org-XYZ` } }),
      { status: 401 },
    )
    const res = await call({ token })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: 'AI 서비스 요청에 실패했습니다.' })
    expect(JSON.stringify(res.body)).not.toMatch(/sk-|Incorrect|org-/)
    expect(logged.join('\n')).toMatch(/openai HTTP 401/)
    expect(logged.join('\n')).not.toContain(leakedKey)
  })

  it('with the caller’s own key, maps a rejected key to a fixed hint (still no provider text)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    openaiResponse = () => new Response(JSON.stringify({ error: { message: 'Incorrect API key provided: sk-user…' } }), { status: 401 })
    const res = await call({ token, body: { prompt: 'p', systemPrompt: 's', userApiKey: 'sk-user-own-key' } })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: '입력한 API 키가 거부되었습니다. 설정에서 키를 확인해 주세요.' })
  })
})
