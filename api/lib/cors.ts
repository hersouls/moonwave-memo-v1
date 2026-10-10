import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * CORS for the packaged Capacitor APK, whose WebView origin is https://localhost
 * (capacitor://localhost on iOS). Web/Electron load the hosted site and stay
 * same-origin, so no other origins are allowed. These endpoints are publicly
 * reachable either way — CORS here only lets the APK's in-browser fetch read
 * responses; it is not an authentication layer (that is api/lib/auth.ts, which
 * needs the `Authorization` request header allowed below).
 */
const ALLOWED_ORIGINS = ['https://localhost', 'capacitor://localhost'] as const

/**
 * Apply CORS headers and answer preflights.
 * Call first in every handler: `if (applyCors(req, res)) return`.
 * Returns true when the request was an OPTIONS preflight and is fully handled.
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  // The header value is our own entry from the list above, never the text the request sent.
  const origin = ALLOWED_ORIGINS.find((allowed) => allowed === req.headers.origin)
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Expose-Headers', 'Retry-After')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
