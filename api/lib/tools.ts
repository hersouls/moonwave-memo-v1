import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Provider } from './models.js'
import { ensureTracing } from './tracing.js'

// ─── API Key Resolution ─────────────────────────────

export function resolveApiKey(provider: Provider, userApiKey?: string): string | null {
  if (userApiKey) return userApiKey

  switch (provider) {
    case 'openai': return process.env.OPENAI_API_KEY || null
    case 'anthropic': return process.env.ANTHROPIC_API_KEY || null
    case 'gemini': return process.env.GEMINI_API_KEY || null
  }
}

// ─── Error Response ─────────────────────────────────

export function errorResponse(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

// ─── Vercel Handler Wrapper ─────────────────────────

type HandlerFn = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>

export function createHandler(fn: HandlerFn) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (req.method !== 'POST') {
      return errorResponse(res, 405, 'Method not allowed')
    }

    ensureTracing()

    try {
      await fn(req, res)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      console.error('[LangChain API Error]', message)
      return errorResponse(res, 500, message)
    }
  }
}
