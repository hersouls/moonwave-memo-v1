import type { VercelRequest, VercelResponse } from '@vercel/node'
import { applyCors } from './lib/cors.js'
import { rateLimiter } from './lib/rateLimit.js'

/**
 * Where the caller roughly is and what the weather is there: what a memo's context record
 * (contextSnapshot, accessLog) and the header's weather line are filled from.
 *
 * The screen used to ask three IP-lookup services and a weather API by itself. A Moonwave
 * screen does not call outside addresses, so the screen asks this route and nothing else:
 * the position comes from the request's own geo headers (set by the host for every request,
 * no lookup is made), and the weather is fetched here, on the server.
 *
 * No login: a memo gets its context record on a signed-out device too. Nothing is spent
 * (Open-Meteo is free and keyless), the answer only ever describes the caller's own
 * request, and the per-address cap below keeps it from being used as an open relay.
 */
const LIMITS = [{ windowMs: 60 * 60_000, max: 30 }] as const

type Condition = 'clear' | 'overcast' | 'rain' | 'snow'

// Open-Meteo WMO weather codes → the four conditions the app knows
function wmoToCondition(code: number): Condition {
  if (code <= 1) return 'clear'
  if (code <= 48) return 'overcast'
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rain'
  if (code <= 77 || (code >= 85 && code <= 86)) return 'snow'
  if (code >= 95) return 'rain'
  return 'overcast'
}

function header(req: VercelRequest, name: string): string {
  const v = req.headers[name]
  return (Array.isArray(v) ? v[0] : v) ?? ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const who = header(req, 'x-real-ip') || header(req, 'x-forwarded-for').split(',')[0].trim() || 'unknown'
  const decision = rateLimiter.hit([{ key: `context:${who}`, windows: LIMITS }])
  if (!decision.allowed) {
    res.setHeader('Retry-After', String(decision.retryAfterSec))
    return res.status(429).json({ error: 'rate_limited' })
  }

  const latitude = Number.parseFloat(header(req, 'x-vercel-ip-latitude'))
  const longitude = Number.parseFloat(header(req, 'x-vercel-ip-longitude'))
  res.setHeader('Cache-Control', 'private, max-age=1800')
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(200).json({ position: null, weather: null })
  }

  let weather: { condition: Condition; temperature: number } | null = null
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(2)}&longitude=${longitude.toFixed(2)}&current_weather=true`
    const upstream = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (upstream.ok) {
      const data = (await upstream.json()) as { current_weather?: { weathercode?: number; temperature?: number } }
      const current = data.current_weather
      if (current && typeof current.weathercode === 'number' && typeof current.temperature === 'number') {
        weather = { condition: wmoToCondition(current.weathercode), temperature: current.temperature }
      }
    }
  } catch { /* the position alone is still an answer */ }

  return res.status(200).json({ position: { latitude, longitude }, weather })
}
