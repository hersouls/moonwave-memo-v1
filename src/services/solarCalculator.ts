// Pure math sunrise/sunset calculator — no external API needed
// Based on NOAA solar calculator equations

const LOCATION_CACHE_KEY = 'memo-geolocation'

interface GeoPosition {
  latitude: number
  longitude: number
  cachedAt: number
}

interface SolarTimes {
  sunrise: Date
  sunset: Date
}

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI
}

export function calculateSolarTimes(lat: number, lon: number, date: Date = new Date()): SolarTimes {
  const dayOfYear = Math.floor(
    (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  )

  // Solar declination (simplified)
  const declination = toRadians(-23.45 * Math.cos(toRadians((360 / 365) * (dayOfYear + 10))))

  // Hour angle
  const latRad = toRadians(lat)
  const cosHourAngle = Math.max(
    -1,
    Math.min(1, -Math.tan(latRad) * Math.tan(declination))
  )
  const hourAngle = toDegrees(Math.acos(cosHourAngle))

  // Solar noon (in hours UTC)
  const solarNoon = 12 - lon / 15

  const sunriseHours = solarNoon - hourAngle / 15
  const sunsetHours = solarNoon + hourAngle / 15

  const sunrise = new Date(date)
  sunrise.setUTCHours(0, 0, 0, 0)
  sunrise.setUTCMinutes(Math.round(sunriseHours * 60))

  const sunset = new Date(date)
  sunset.setUTCHours(0, 0, 0, 0)
  sunset.setUTCMinutes(Math.round(sunsetHours * 60))

  return { sunrise, sunset }
}

export function getSolarMode(lat: number, lon: number): 'light' | 'dark' {
  const now = new Date()
  const { sunrise, sunset } = calculateSolarTimes(lat, lon, now)
  return now >= sunrise && now < sunset ? 'light' : 'dark'
}

export function getCachedPosition(): GeoPosition | null {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY)
    if (!cached) return null
    const pos: GeoPosition = JSON.parse(cached)
    // Cache valid for 24 hours
    if (Date.now() - pos.cachedAt > 24 * 60 * 60 * 1000) return null
    return pos
  } catch {
    return null
  }
}

// Fallback: Seoul, South Korea
const DEFAULT_POSITION: GeoPosition = {
  latitude: 37.5665,
  longitude: 126.9780,
  cachedAt: 0,
}

function cachePosition(geo: GeoPosition) {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(geo))
  } catch { /* storage full */ }
}

// IP-based geolocation fallback (no API key required)
async function getPositionByIP(): Promise<GeoPosition | null> {
  try {
    const res = await fetch('https://get.geojs.io/v1/ip/geo.json', { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = await res.json()
    const lat = parseFloat(data.latitude)
    const lon = parseFloat(data.longitude)
    if (isNaN(lat) || isNaN(lon)) return null
    return { latitude: lat, longitude: lon, cachedAt: Date.now() }
  } catch {
    return null
  }
}

export async function requestAndCachePosition(): Promise<GeoPosition> {
  // 1) Try browser Geolocation API
  const browserPos = await new Promise<GeoPosition | null>((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        cachedAt: Date.now(),
      }),
      () => resolve(null),
      { timeout: 10000, enableHighAccuracy: false }
    )
  })

  if (browserPos) {
    cachePosition(browserPos)
    return browserPos
  }

  // 2) Fallback: IP-based geolocation
  const ipPos = await getPositionByIP()
  if (ipPos) {
    cachePosition(ipPos)
    return ipPos
  }

  // 3) Last resort: Seoul default
  return DEFAULT_POSITION
}
