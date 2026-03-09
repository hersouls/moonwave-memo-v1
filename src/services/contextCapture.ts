import { getCachedPosition, getSolarMode } from './solarCalculator'
import type { ContextSnapshot, WeatherCondition } from '@/lib/types'

const WEATHER_CACHE_KEY = 'memo-weather-cache'

export function captureContext(): ContextSnapshot {
  const now = new Date()
  const hour = now.getHours()

  // Try to get cached weather
  let weather: WeatherCondition | null = null
  let temperature: number | null = null
  try {
    const cached = localStorage.getItem(WEATHER_CACHE_KEY)
    if (cached) {
      const data = JSON.parse(cached)
      weather = data.condition || null
      temperature = data.temperature ?? null
    }
  } catch { /* ignore */ }

  // Get solar mode from cached position
  let solarMode: 'light' | 'dark' = hour >= 6 && hour < 18 ? 'light' : 'dark'
  const pos = getCachedPosition()
  if (pos) {
    solarMode = getSolarMode(pos.latitude, pos.longitude)
  }

  return { weather, temperature, hour, solarMode }
}
