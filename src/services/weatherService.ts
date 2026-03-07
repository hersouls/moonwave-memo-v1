import type { WeatherCondition } from '@/lib/types'

const WEATHER_CACHE_KEY = 'memo-weather-cache'
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

interface WeatherCache {
  condition: WeatherCondition
  temperature: number
  fetchedAt: number
}

// Open-Meteo WMO weather codes to our conditions
function wmoToCondition(code: number): WeatherCondition {
  // Clear / Mainly clear
  if (code <= 1) return 'clear'
  // Overcast / Partly cloudy / Fog
  if (code <= 48) return 'overcast'
  // Drizzle / Rain / Rain showers
  if (code <= 67 || (code >= 80 && code <= 82)) return 'rain'
  // Snow / Snow showers / Snow grains
  if (code <= 77 || (code >= 85 && code <= 86)) return 'snow'
  // Thunderstorm
  if (code >= 95) return 'rain'
  return 'overcast'
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

export async function fetchWeather(
  lat: number,
  lon: number
): Promise<{ condition: WeatherCondition; temperature: number } | null> {
  // Check cache first
  const cached = getCachedWeather()
  if (cached) return { condition: cached.condition, temperature: cached.temperature }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
    const res = await fetch(url)
    if (!res.ok) return null

    const data = await res.json()
    const current = data.current_weather
    if (!current) return null

    const condition = wmoToCondition(current.weathercode)
    const temperature = current.temperature

    setCachedWeather({ condition, temperature, fetchedAt: Date.now() })

    return { condition, temperature }
  } catch {
    return null
  }
}
