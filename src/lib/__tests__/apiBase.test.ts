import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface MockUser { getIdToken: (forceRefresh?: boolean) => Promise<string> }
const mockAuth: { currentUser: MockUser | null; authStateReady: () => Promise<void> } = {
  currentUser: null,
  authStateReady: async () => {},
}

vi.mock('@/lib/firebase', () => ({ auth: mockAuth }))
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }))

const { authedFetch, apiErrorMessage, AuthRequiredError, AI_LOGIN_REQUIRED_MESSAGE } = await import('../apiBase')

const fetchMock = vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  mockAuth.currentUser = null
  mockAuth.authStateReady = async () => {}
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const authHeader = (call: number) => new Headers(fetchMock.mock.calls[call][1]?.headers).get('Authorization')

describe('authedFetch', () => {
  it('attaches the Firebase ID token as a Bearer header and keeps the request intact', async () => {
    const getIdToken = vi.fn(async () => 'id-token-1')
    mockAuth.currentUser = { getIdToken }

    const body = JSON.stringify({ prompt: 'p' })
    await authedFetch('/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ai')
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(body)
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer id-token-1')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(getIdToken).toHaveBeenCalledWith(false)
  })

  it('signed out: throws the Korean login message and sends nothing', async () => {
    const err = await authedFetch('/api/ai', { method: 'POST' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(AuthRequiredError)
    expect((err as Error).message).toBe('AI 기능은 로그인 후 사용할 수 있어요')
    expect(AI_LOGIN_REQUIRED_MESSAGE).toBe('AI 기능은 로그인 후 사용할 수 있어요')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('waits for Firebase to restore the session before deciding the user is signed out', async () => {
    mockAuth.authStateReady = async () => {
      mockAuth.currentUser = { getIdToken: async () => 'restored-token' }
    }
    await authedFetch('/api/langchain/tags', { method: 'POST' })
    expect(authHeader(0)).toBe('Bearer restored-token')
  })

  it('on 401 refreshes the token once and retries', async () => {
    const getIdToken = vi.fn(async (force?: boolean) => (force ? 'fresh-token' : 'stale-token'))
    mockAuth.currentUser = { getIdToken }
    fetchMock
      .mockResolvedValueOnce(new Response('{"error":"unauthorized"}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{"text":"ok"}', { status: 200 }))

    const res = await authedFetch('/api/ai', { method: 'POST', body: '{}' })
    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(authHeader(0)).toBe('Bearer stale-token')
    expect(authHeader(1)).toBe('Bearer fresh-token')
    expect(getIdToken).toHaveBeenLastCalledWith(true)
  })

  it('does not retry other failures', async () => {
    mockAuth.currentUser = { getIdToken: async () => 't' }
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 }))
    const res = await authedFetch('/api/ai', { method: 'POST' })
    expect(res.status).toBe(429)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('apiErrorMessage', () => {
  it('maps auth / size / rate-limit statuses to Korean messages', async () => {
    expect(await apiErrorMessage(new Response('', { status: 401 }))).toMatch(/로그인/)
    expect(await apiErrorMessage(new Response('', { status: 403 }))).toMatch(/사용할 수 없어요/)
    expect(await apiErrorMessage(new Response('', { status: 413 }))).toMatch(/너무 길어요/)
    expect(await apiErrorMessage(new Response('', { status: 429, headers: { 'Retry-After': '120' } }))).toMatch(/2분 후/)
    expect(await apiErrorMessage(new Response('', { status: 429, headers: { 'Retry-After': '42' } }))).toMatch(/42초 후/)
  })

  it('shows the server’s own Korean 5xx message, but never arbitrary text', async () => {
    const korean = new Response(JSON.stringify({ error: 'AI 서비스 요청에 실패했습니다.' }), { status: 502 })
    expect(await apiErrorMessage(korean)).toBe('AI 서비스 요청에 실패했습니다.')
    const english = new Response(JSON.stringify({ error: 'Incorrect API key provided: sk-…' }), { status: 502 })
    expect(await apiErrorMessage(english)).toBe('서버 오류: 502')
  })
})
