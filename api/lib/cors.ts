import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * CORS for the packaged Capacitor APK, whose WebView origin is https://localhost
 * (capacitor://localhost on iOS). Web/Electron load the hosted site and stay
 * same-origin, so no other origins are allowed. These endpoints are publicly
 * reachable either way — CORS here only lets the APK's in-browser fetch read
 * responses; it is not an authentication layer.
 */
const ALLOWED_ORIGINS = new Set(['https://localhost', 'capacitor://localhost'])

/**
 * Apply CORS headers and answer preflights.
 * Call first in every handler: `if (applyCors(req, res)) return`.
 * Returns true when the request was an OPTIONS preflight and is fully handled.
 */
export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Max-Age', '86400')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  return false
}
