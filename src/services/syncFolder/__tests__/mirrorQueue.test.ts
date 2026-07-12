import { describe, it, expect } from 'vitest'
import { backoffMs, planRetry, MAX_ATTEMPTS, BASE_BACKOFF_MS, MAX_BACKOFF_MS } from '../mirrorQueue'

describe('mirrorQueue backoff (§4.6)', () => {
  it('grows exponentially from the base', () => {
    expect(backoffMs(1)).toBe(BASE_BACKOFF_MS)
    expect(backoffMs(2)).toBe(BASE_BACKOFF_MS * 2)
    expect(backoffMs(3)).toBe(BASE_BACKOFF_MS * 4)
  })

  it('caps at the maximum backoff', () => {
    expect(backoffMs(20)).toBe(MAX_BACKOFF_MS)
    expect(backoffMs(1000)).toBeLessThanOrEqual(MAX_BACKOFF_MS)
  })
})

describe('mirrorQueue planRetry', () => {
  const now = 1_000_000

  it('schedules the next retry with backoff on failure', () => {
    const plan = planRetry(0, now)
    expect(plan.giveUp).toBe(false)
    expect(plan.attempts).toBe(1)
    expect(new Date(plan.nextRetryAt).getTime()).toBe(now + BASE_BACKOFF_MS)
  })

  it('keeps retrying below the attempt cap', () => {
    const plan = planRetry(MAX_ATTEMPTS - 2, now)
    expect(plan.giveUp).toBe(false)
    expect(plan.attempts).toBe(MAX_ATTEMPTS - 1)
  })

  it('gives up once max attempts are reached', () => {
    const plan = planRetry(MAX_ATTEMPTS - 1, now)
    expect(plan.attempts).toBe(MAX_ATTEMPTS)
    expect(plan.giveUp).toBe(true)
  })
})
