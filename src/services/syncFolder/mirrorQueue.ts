/**
 * Retry scheduling for the NAS-mirror queue (Phase 2 M3 · §4.6 pendingFileOps).
 *
 * Pure functions only — the exponential-backoff schedule and the give-up rule for a
 * failed mirror write/delete. `now` is injected so this is deterministic and testable.
 */
export const MAX_ATTEMPTS = 10
export const BASE_BACKOFF_MS = 5_000
export const MAX_BACKOFF_MS = 10 * 60 * 1000 // 10 minutes

/** Exponential backoff for the given attempt count (1-based), capped at MAX_BACKOFF_MS. */
export function backoffMs(attempts: number): number {
  const n = Math.max(attempts, 1)
  return Math.min(BASE_BACKOFF_MS * 2 ** (n - 1), MAX_BACKOFF_MS)
}

export interface RetryPlan {
  /** true → stop retrying (max attempts reached); the op should be dropped. */
  giveUp: boolean
  /** New attempt count to persist. */
  attempts: number
  /** ISO timestamp of the next retry (only meaningful when !giveUp). */
  nextRetryAt: string
}

/** Decide what happens to an op after a failed attempt. */
export function planRetry(currentAttempts: number, now: number): RetryPlan {
  const attempts = currentAttempts + 1
  if (attempts >= MAX_ATTEMPTS) {
    return { giveUp: true, attempts, nextRetryAt: new Date(now).toISOString() }
  }
  return { giveUp: false, attempts, nextRetryAt: new Date(now + backoffMs(attempts)).toISOString() }
}
