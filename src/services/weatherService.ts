import type { WeatherCondition } from '@/lib/types'
import { fetchContext } from './contextApi'

const WEATHER_CACHE_KEY = 'memo-weather-cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface WeatherCache {
  condition: WeatherCondition
  temperature: number
  fetchedAt: number
}

function getCachedWeather(): WeatherCache | null {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY)
    if (!raw) return null
    const cache: WeatherCache = JSON.parse(raw)
    if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null
    return cache
  } catch {
    return null
  }
}

function setCachedWeather(data: WeatherCache) {
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(data))
  } catch { /* storage full */ }
}

/** 지금 있는 곳의 날씨예요. 서비스 자신의 API(/api/context)가 답하고, 한 시간 동안 기억해요. */
export async function fetchWeather(): Promise<{ condition: WeatherCondition; temperature: number } | null> {
  const cached = getCachedWeather()
  if (cached) return { condition: cached.condition, temperature: cached.temperature }

  const context = await fetchContext()
  if (!context?.weather) return null
  const { condition, temperature } = context.weather
  setCachedWeather({ condition, temperature, fetchedAt: Date.now() })
  return { condition, temperature }
}
