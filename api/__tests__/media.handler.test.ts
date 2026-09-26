import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ocr from '../ocr.js'
import stt from '../stt.js'
import { rateLimiter } from '../lib/rateLimit.js'
import { GOOGLE_JWKS_URL, makeKeys, mintToken, type TestKeys } from './firebaseTokens.js'
import { callHandler } from './harness.js'

let keys: TestKeys
let token: string
let providerResponse: () => Response
const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url === GOOGLE_JWKS_URL) return new Response(JSON.stringify(keys.jwks), { status: 200 })
  if (url.startsWith('https://api.openai.com/')) return providerResponse()
  throw new Error(`unexpected fetch ${url}`)
})
const providerCalls = () => fetchMock.mock.calls.filter(([u]) => String(u).startsWith('https://api.openai.com/'))
// Built at runtime so the repo's secret scanner doesn't see a key-shaped literal.
const leakedKey = ['sk', 'proj', 'leakme1234'].join('-')
const leakyError = () => new Response(
  JSON.stringify({ error: { message: `You exceeded your current quota for org-SECRET, key ${leakedKey}` } }),
  { status: 429 },
)

const IMAGE = `data:image/png;base64,${'A'.repeat(100)}`
const AUDIO = Buffer.from('fake audio bytes').toString('base64')

beforeAll(async () => {
  keys = await makeKeys('kid-media')
  token = await mintToken(keys, { sub: 'uid-media' })
})

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  rateLimiter.clear()
  process.env.OPENAI_API_KEY = 'sk-server-test-key-000000'
  providerResponse = () => new Response(JSON.stringify({ choices: [{ message: { content: 'text' } }], text: 'text' }), { status: 200 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api/ocr', () => {
  it('401 without a token', async () => {
    const res = await callHandler(ocr, { body: { imageDataUrl: IMAGE } })
    expect(res.statusCode).toBe(401)
    expect(providerCalls()).toHaveLength(0)
  })

  it('200 for a signed-in user', async () => {
    const res = await callHandler(ocr, { token, body: { imageDataUrl: IMAGE } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ text: 'text', usingServerKey: true })
  })

  it('413 for an image data URL over the cap', async () => {
    const res = await callHandler(ocr, { token, body: { imageDataUrl: `data:image/png;base64,${'A'.repeat(3_500_001)}` } })
    expect(res.statusCode).toBe(413)
    expect(providerCalls()).toHaveLength(0)
  })

  it('400 for a remote URL instead of an inline image', async () => {
    const res = await callHandler(ocr, { token, body: { imageDataUrl: 'https://example.com/huge.png' } })
    expect(res.statusCode).toBe(400)
    expect(providerCalls()).toHaveLength(0)
  })

  it('429 after 10 OCR requests in 5 minutes', async () => {
    for (let i = 0; i < 10; i++) expect((await callHandler(ocr, { token, body: { imageDataUrl: IMAGE } })).statusCode).toBe(200)
    const res = await callHandler(ocr, { token, body: { imageDataUrl: IMAGE } })
    expect(res.statusCode).toBe(429)
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('never echoes the provider error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    providerResponse = leakyError
    const res = await callHandler(ocr, { token, body: { imageDataUrl: IMAGE } })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: 'AI 서비스 요청에 실패했습니다.' })
  })
})

describe('api/stt', () => {
  it('401 without a token', async () => {
    const res = await callHandler(stt, { body: { audioBase64: AUDIO } })
    expect(res.statusCode).toBe(401)
    expect(providerCalls()).toHaveLength(0)
  })

  it('200 for a signed-in user', async () => {
    const res = await callHandler(stt, { token, body: { audioBase64: AUDIO, fileName: 'memo.m4a', language: 'ko' } })
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ text: 'text', usingServerKey: true })
  })

  it('413 for audio over the cap', async () => {
    const res = await callHandler(stt, { token, body: { audioBase64: 'A'.repeat(4_650_001) } })
    expect(res.statusCode).toBe(413)
    expect(providerCalls()).toHaveLength(0)
  })

  it('never echoes the provider error', async () => {
    const logged: string[] = []
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { logged.push(args.map(String).join(' ')) })
    providerResponse = leakyError
    const res = await callHandler(stt, { token, body: { audioBase64: AUDIO } })
    expect(res.statusCode).toBe(502)
    expect(res.body).toEqual({ error: 'AI 서비스 요청에 실패했습니다.' })
    expect(logged.join('\n')).not.toContain(leakedKey)
  })
})
