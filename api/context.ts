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
 * (Open-Meteo is free and keyless) and the answer only ever describes the caller's own request.
 *
 * What is capped is the one thing this route asks of anyone else, the weather lookup, and not
 * the answer. Every screen asks this route once when it opens, so a cap on the answer turned
 * an ordinary household (several devices behind one address) or a run of page loads into 429s
 * on the first screen. The position costs nothing and is always answered. The weather is kept
 * per place for half an hour, and only a lookup that is not in that memory counts against the
 * address; past the cap the answer simply carries no weather, as when the lookup fails.
 */
const LOOKUP_LIMITS = [{ windowMs: 60 * 60_000, max: 30 }] as const
const WEATHER_TTL_MS = 30 * 60_000
const WEATHER_PLACES_MAX = 500

type Condition = 'clear' | 'overcast' | 'rain' | 'snow'
type Weather = { condition: Condition; temperature: number }

/** place ("37.57,126.98") → what was last read there. Per instance, like the limiter. */
const weatherByPlace = new Map<string, { weather: Weather; at: number }>()

/** Forget the remembered weather (tests). */
export function clearWeatherMemory(): void {
  weatherByPlace.clear()
}

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

async function lookUpWeather(place: string): Promise<Weather | null> {
  const [latitude, longitude] = place.split(',')
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    const upstream = await fetch(url, { signal: AbortSignal.timeout(4000) })
    if (!upstream.ok) return null
    const data = (await upstream.json()) as { current_weather?: { weathercode?: number; temperature?: number } }
    const current = data.current_weather
    if (current && typeof current.weathercode === 'number' && typeof current.temperature === 'number') {
      return { condition: wmoToCondition(current.weathercode), temperature: current.temperature }
    }
  } catch { /* the position alone is still an answer */ }
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const latitude = Number.parseFloat(header(req, 'x-vercel-ip-latitude'))
  const longitude = Number.parseFloat(header(req, 'x-vercel-ip-longitude'))
  res.setHeader('Cache-Control', 'private, max-age=1800')
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(200).json({ position: null, weather: null })
  }

  const now = Date.now()
  const place = `${latitude.toFixed(2)},${longitude.toFixed(2)}`
  const known = weatherByPlace.get(place)
  let weather: Weather | null = known && now - known.at < WEATHER_TTL_MS ? known.weather : null
  if (!weather) {
    const who = header(req, 'x-real-ip') || header(req, 'x-forwarded-for').split(',')[0].trim() || 'unknown'
    if (rateLimiter.hit([{ key: `context:${who}`, windows: LOOKUP_LIMITS }], now).allowed) {
      weather = await lookUpWeather(place)
      if (weather) {
        if (weatherByPlace.size >= WEATHER_PLACES_MAX) weatherByPlace.clear()
        weatherByPlace.set(place, { weather, at: now })
      }
    }
  }

  return res.status(200).json({ position: { latitude, longitude }, weather })
}
