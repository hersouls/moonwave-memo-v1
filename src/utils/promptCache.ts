const CACHE_MAX = 50
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

interface CacheEntry {
  value: unknown
  timestamp: number
}

const cache = new Map<string, CacheEntry>()

function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash.toString(36)
}

export function generateCacheKey(fn: string, content: string): string {
  // Hash the FULL content (plus its length) — a 500-char prefix hash collides for any
  // two inputs sharing their first 500 chars, so an edit past char 500 would return a
  // stale cached AI result within the TTL. Content sent to the model is <=5000 chars,
  // so hashing all of it is negligible.
  return `${fn}:${simpleHash(content)}:${content.length}`
}

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key)
    return null
  }
  // Move to end for LRU ordering (Map preserves insertion order)
  cache.delete(key)
  cache.set(key, entry)
  return entry.value as T
}

export function setCache(key: string, value: unknown): void {
  // Evict oldest if at capacity
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { value, timestamp: Date.now() })
}
