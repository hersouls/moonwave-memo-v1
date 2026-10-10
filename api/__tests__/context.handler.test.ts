import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import context, { clearWeatherMemory } from '../context.js'
import { rateLimiter } from '../lib/rateLimit.js'
import { callHandler } from './harness.js'

const SEOUL = { 'x-vercel-ip-latitude': '37.5665', 'x-vercel-ip-longitude': '126.9780', 'x-real-ip': '203.0.113.7' }
let upstream: () => Response
const fetchMock = vi.fn(async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input)
  if (url.startsWith('https://api.open-meteo.com/')) return upstream()
  throw new Error(`unexpected fetch ${url}`)
})
const get = (headers: Record<string, string>) => callHandler(context, { method: 'GET', headers })

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockClear()
  rateLimiter.clear()
  clearWeatherMemory()
  upstream = () => new Response(JSON.stringify({ current_weather: { weathercode: 61, temperature: 17.4 } }), { status: 200 })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('api/context', () => {
  it('answers the position and the weather of the place', async () => {
    const res = await get(SEOUL)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ position: { latitude: 37.5665, longitude: 126.978 }, weather: { condition: 'rain', temperature: 17.4 } })
    expect(String(fetchMock.mock.calls[0][0])).toContain('latitude=37.57&longitude=126.98')
  })

  it('answers without a position when the host sent no geo headers', async () => {
    const res = await get({ 'x-real-ip': '203.0.113.7' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ position: null, weather: null })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('405 for anything but GET', async () => {
    const res = await callHandler(context, { method: 'POST', headers: SEOUL })
    expect(res.statusCode).toBe(405)
  })

  it('looks the weather of a place up once, however many screens ask', async () => {
    for (let i = 0; i < 200; i++) {
      const res = await get(SEOUL)
      expect(res.statusCode).toBe(200)
      expect((res.body as { weather: unknown }).weather).toEqual({ condition: 'rain', temperature: 17.4 })
    }
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never answers 429: past the lookup cap the answer carries the position and no weather', async () => {
    upstream = () => new Response('busy', { status: 503 }) // nothing to remember, so every call is a lookup
    for (let i = 0; i < 40; i++) {
      const res = await get(SEOUL)
      expect(res.statusCode).toBe(200)
      expect(res.body).toEqual({ position: { latitude: 37.5665, longitude: 126.978 }, weather: null })
    }
    expect(fetchMock).toHaveBeenCalledTimes(30) // the cap is on what is asked of the weather service
  })

  it('counts lookups per address', async () => {
    upstream = () => new Response('busy', { status: 503 })
    for (let i = 0; i < 35; i++) await get(SEOUL)
    await get({ ...SEOUL, 'x-real-ip': '198.51.100.9' })
    expect(fetchMock).toHaveBeenCalledTimes(31)
  })
})
