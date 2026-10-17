/**
 * In-memory sliding-window rate limiter (sliding log of request timestamps).
 *
 * BEST EFFORT, PER INSTANCE: state lives in this function instance's memory only. Vercel
 * may run several instances at once and recycles them, so the effective ceiling is
 * "limit × concurrent instances" and a cold start forgets history. No external store is
 * available (free plans, no service account); this still stops a single client from
 * hammering the paid providers in a tight loop.
 */

export interface RateWindow {
  windowMs: number
  max: number
}

export interface RateBucket {
  key: string
  windows: readonly RateWindow[]
}

export type RateDecision = { allowed: true } | { allowed: false; retryAfterSec: number }

interface Log {
  stamps: number[] // ascending
  horizonMs: number // longest window seen for this key
}

/** Number of entries in the ascending array that are > cutoff (binary search). */
function countAfter(stamps: readonly number[], cutoff: number): number {
  let lo = 0
  let hi = stamps.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (stamps[mid] > cutoff) hi = mid
    else lo = mid + 1
  }
  return stamps.length - lo
}

export class SlidingWindowLimiter {
  private readonly logs = new Map<string, Log>()

  constructor(private readonly maxKeys = 10_000) {}

  /**
   * Check every bucket; record the request in ALL of them only when ALL allow it (a request
   * rejected by one bucket must not consume another's quota). Rejected requests are never
   * recorded, so a client that keeps retrying doesn't extend its own lockout.
   */
  hit(buckets: readonly RateBucket[], now = Date.now()): RateDecision {
    let retryAfterMs = 0
    const pending: Array<{ key: string; log: Log }> = []

    for (const { key, windows } of buckets) {
      const horizonMs = Math.max(...windows.map((w) => w.windowMs))
      const log = this.logs.get(key) ?? { stamps: [], horizonMs }
      log.horizonMs = Math.max(log.horizonMs, horizonMs)
      const expired = log.stamps.length - countAfter(log.stamps, now - log.horizonMs)
      if (expired > 0) log.stamps.splice(0, expired)

      for (const w of windows) {
        const inWindow = countAfter(log.stamps, now - w.windowMs)
        if (inWindow >= w.max) {
          // Allowed again once the in-window count drops below max, i.e. when the
          // max-th most recent hit ages out of the window.
          const blocking = log.stamps[log.stamps.length - w.max] ?? now
          retryAfterMs = Math.max(retryAfterMs, blocking + w.windowMs - now, 1)
        }
      }
      pending.push({ key, log })
    }

    if (retryAfterMs > 0) return { allowed: false, retryAfterSec: Math.ceil(retryAfterMs / 1000) }

    for (const { key, log } of pending) {
      log.stamps.push(now)
      this.logs.set(key, log)
    }
    if (this.logs.size > this.maxKeys) this.evict(now)
    return { allowed: true }
  }

  /** Drop idle keys; if still over capacity, drop the oldest-created ones. */
  private evict(now: number): void {
    for (const [key, log] of this.logs) {
      const last = log.stamps[log.stamps.length - 1]
      if (last === undefined || last <= now - log.horizonMs) this.logs.delete(key)
    }
    for (const key of this.logs.keys()) {
      if (this.logs.size <= this.maxKeys) break
      this.logs.delete(key)
    }
  }

  /** Forget everything (tests). */
  clear(): void {
    this.logs.clear()
  }
}

/** Shared limiter for all AI routes in this instance. */
export const rateLimiter = new SlidingWindowLimiter()
