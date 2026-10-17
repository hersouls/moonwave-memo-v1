import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Every route that can spend a paid provider key must refuse an unauthenticated request
// before doing anything else (no provider call, no JWKS fetch for a missing token).
type Route = { default: (req: VercelRequest, res: VercelResponse) => Promise<unknown> }
// The langchain routes are served by one function, api/langchain/[action].ts.
const routed = async (action: string): Promise<Route> => {
  const router = (await import('../langchain/[action].js')).default
  return { default: (req, res) => router({ ...req, query: { action } } as unknown as VercelRequest, res) }
}
const PAID_ROUTES: Record<string, () => Promise<Route>> = {
  ai: () => import('../ai.js'),
  ocr: () => import('../ocr.js'),
  stt: () => import('../stt.js'),
  'langchain/analyze': () => routed('analyze'),
  'langchain/autocomplete': () => routed('autocomplete'),
  'langchain/briefing': () => routed('briefing'),
  'langchain/classify': () => routed('classify'),
  'langchain/demian': () => routed('demian'),
  'langchain/digest': () => routed('digest'),
  'langchain/embedding': () => routed('embedding'),
  'langchain/insights': () => routed('insights'),
  'langchain/readability': () => routed('readability'),
  'langchain/search': () => routed('search'),
  'langchain/stream': () => routed('stream'),
  'langchain/summarize': () => routed('summarize'),
  'langchain/tags': () => routed('tags'),
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('paid AI routes require a Firebase login', () => {
  it.each(Object.keys(PAID_ROUTES))('/api/%s → 401 without a token', async (route) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const mod = await PAID_ROUTES[route]()
    let status = 0
    let body: unknown
    const res = {
      status(code: number) { status = code; return this },
      json(b: unknown) { body = b; return this },
      setHeader() { return this },
      writeHead() { throw new Error('must not start streaming') },
      end() { return this },
    }
    const req = {
      method: 'POST',
      headers: {},
      body: { prompt: 'p', systemPrompt: 's', content: 'x'.repeat(100), text: 't', query: 'q', messages: [{ role: 'user', content: 'hi' }] },
      query: {},
    }
    await mod.default(req as unknown as VercelRequest, res as unknown as VercelResponse)
    expect(status).toBe(401)
    expect(body).toEqual({ error: 'unauthorized' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the langchain router', () => {
  it('answers 404 for an action it does not have', async () => {
    const router = (await import('../langchain/[action].js')).default
    let status = 0
    const res = { status(code: number) { status = code; return this }, json() { return this } }
    await router({ method: 'POST', headers: {}, query: { action: 'nope' } } as unknown as VercelRequest, res as unknown as VercelResponse)
    expect(status).toBe(404)
  })
})
