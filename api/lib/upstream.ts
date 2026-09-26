import type { VercelResponse } from '@vercel/node'

/**
 * Provider (OpenAI / Anthropic / Gemini) failures: the raw error body is LOGGED (with
 * key-like strings redacted) and NEVER returned — it can carry masked key fragments, org
 * ids, or quota/billing state. Callers get a generic Korean message + status.
 */

export const GENERIC_AI_ERROR = 'AI 서비스 요청에 실패했습니다.'

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly status: number,
    readonly detail = '',
  ) {
    super(`${provider} upstream error ${status}`)
    this.name = 'ProviderError'
  }
}

/** Build a ProviderError from a non-OK provider response (reads at most a short excerpt). */
export async function providerError(provider: string, res: Response): Promise<ProviderError> {
  const detail = await res.text().catch(() => '')
  return new ProviderError(provider, res.status, detail.slice(0, 500))
}

const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-[A-Za-z0-9_*-]{4,}/g, // OpenAI / Anthropic (sk-ant-…), incl. masked "sk-proj-****abcd"
  /AIza[0-9A-Za-z_-]{10,}/g, // Google API keys
  /([?&]key=)[^&\s"']+/gi,
  /(Bearer\s+)[A-Za-z0-9._~+/-]+=*/gi,
]

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((s, re) => s.replace(re, (_m, prefix?: string) => `${typeof prefix === 'string' ? prefix : ''}[redacted]`), text)
}

export function logUpstreamError(scope: string, err: unknown): void {
  if (err instanceof ProviderError) {
    console.error(`[${scope}] ${err.provider} HTTP ${err.status}:`, redactSecrets(err.detail))
  } else {
    console.error(`[${scope}]`, redactSecrets(err instanceof Error ? `${err.name}: ${err.message}` : String(err)))
  }
}

/**
 * Log `err` and send a provider-text-free 502. With the caller's OWN key a rejected key or
 * provider quota is actionable for them, so those map to fixed hints; with the server's key
 * every failure is the same generic message (nothing about our key/billing state leaks).
 */
export function sendUpstreamError(res: VercelResponse, scope: string, err: unknown, usingServerKey: boolean) {
  logUpstreamError(scope, err)
  let message = GENERIC_AI_ERROR
  if (!usingServerKey && err instanceof ProviderError) {
    if (err.status === 401 || err.status === 403) message = '입력한 API 키가 거부되었습니다. 설정에서 키를 확인해 주세요.'
    else if (err.status === 429) message = 'AI 제공자의 요청 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.'
  }
  return res.status(502).json({ error: message })
}
