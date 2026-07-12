import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Provider } from './models.js'
import { ensureTracing } from './tracing.js'
import { applyCors } from './cors.js'

// ─── API Key Resolution ─────────────────────────────

function serverKey(provider: Provider): string | null {
  switch (provider) {
    case 'openai': return process.env.OPENAI_API_KEY || null
    case 'anthropic': return process.env.ANTHROPIC_API_KEY || null
    case 'gemini': return process.env.GEMINI_API_KEY || null
  }
}

// A user key that unambiguously belongs to a DIFFERENT provider (Anthropic 'sk-ant-'
// or Gemini 'AIza') sent to this provider would 401 — ignore it and use the server key
// instead of failing the request. Defense-in-depth behind the provider-matched client
// selection; conservative so unusual-but-valid keys (e.g. OpenAI 'sk-proj-') still pass.
function keyMatchesProvider(provider: Provider, key: string): boolean {
  if (key.startsWith('sk-ant-')) return provider === 'anthropic'
  if (key.startsWith('AIza')) return provider === 'gemini'
  return true
}

export function resolveApiKey(provider: Provider, userApiKey?: string): string | null {
  if (userApiKey && keyMatchesProvider(provider, userApiKey)) return userApiKey
  return serverKey(provider)
}

// ─── Error Response ─────────────────────────────────

export function errorResponse(res: VercelResponse, status: number, message: string) {
  return res.status(status).json({ error: message })
}

// ─── Vercel Handler Wrapper ─────────────────────────

type HandlerFn = (req: VercelRequest, res: VercelResponse) => Promise<void | VercelResponse>

export function createHandler(fn: HandlerFn) {
  return async (req: VercelRequest, res: VercelResponse) => {
    // CORS + preflight must run before the method gate — an OPTIONS preflight is
    // not POST, so checking method first would 405 the preflight (blocking the APK).
    if (applyCors(req, res)) return

    if (req.method !== 'POST') {
      return errorResponse(res, 405, 'Method not allowed')
    }

    ensureTracing()

    try {
      await fn(req, res)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error'
      // Log the full upstream message but return a GENERIC one — the raw provider error
      // can contain the masked server key, org id, or billing/quota state, and these
      // endpoints are reachable without auth.
      console.error('[LangChain API Error]', message)
      return errorResponse(res, 500, 'AI 서비스 요청에 실패했습니다.')
    }
  }
}
