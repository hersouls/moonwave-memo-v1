import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VercelRequest, VercelResponse } from '@vercel/node'

// Every route that can spend a paid provider key must refuse an unauthenticated request
// before doing anything else (no provider call, no JWKS fetch for a missing token).
type Route = { default: (req: VercelRequest, res: VercelResponse) => Promise<unknown> }
const PAID_ROUTES: Record<string, () => Promise<Route>> = {
  ai: () => import('../ai.js'),
  ocr: () => import('../ocr.js'),
  stt: () => import('../stt.js'),
  'langchain/analyze': () => import('../langchain/analyze.js'),
  'langchain/autocomplete': () => import('../langchain/autocomplete.js'),
  'langchain/briefing': () => import('../langchain/briefing.js'),
  'langchain/classify': () => import('../langchain/classify.js'),
  'langchain/demian': () => import('../langchain/demian.js'),
  'langchain/digest': () => import('../langchain/digest.js'),
  'langchain/embedding': () => import('../langchain/embedding.js'),
  'langchain/insights': () => import('../langchain/insights.js'),
  'langchain/readability': () => import('../langchain/readability.js'),
  'langchain/search': () => import('../langchain/search.js'),
  'langchain/stream': () => import('../langchain/stream.js'),
  'langchain/summarize': () => import('../langchain/summarize.js'),
  'langchain/tags': () => import('../langchain/tags.js'),
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
