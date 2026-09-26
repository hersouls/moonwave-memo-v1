import { describe, expect, it } from 'vitest'
import { SlidingWindowLimiter } from '../lib/rateLimit.js'
import { measureInput } from '../lib/guard.js'

const MIN = 60_000

describe('SlidingWindowLimiter', () => {
  it('allows up to max per window, then reports when the oldest hit ages out', () => {
    const limiter = new SlidingWindowLimiter()
    const bucket = [{ key: 'ai:u1', windows: [{ windowMs: 5 * MIN, max: 3 }] }]
    const t0 = 1_000_000
    expect(limiter.hit(bucket, t0)).toEqual({ allowed: true })
    expect(limiter.hit(bucket, t0 + 1_000)).toEqual({ allowed: true })
    expect(limiter.hit(bucket, t0 + 2_000)).toEqual({ allowed: true })
    // 4th within the window: blocked until t0 + 5 min
    expect(limiter.hit(bucket, t0 + 60_000)).toEqual({ allowed: false, retryAfterSec: 240 })
    // rejected hits are not recorded, and the window slides
    expect(limiter.hit(bucket, t0 + 5 * MIN + 1)).toEqual({ allowed: true })
    expect(limiter.hit(bucket, t0 + 5 * MIN + 2)).toEqual({ allowed: false, retryAfterSec: 1 })
  })

  it('enforces the longer (daily) window independently', () => {
    const limiter = new SlidingWindowLimiter()
    const bucket = [{ key: 'k', windows: [{ windowMs: 5 * MIN, max: 2 }, { windowMs: 24 * 60 * MIN, max: 3 }] }]
    let t = 0
    for (let i = 0; i < 3; i++, t += 10 * MIN) expect(limiter.hit(bucket, t).allowed).toBe(true)
    const d = limiter.hit(bucket, t)
    expect(d.allowed).toBe(false)
    if (!d.allowed) expect(d.retryAfterSec).toBe(24 * 3600 - 30 * 60)
  })

  it('keeps uids and families separate', () => {
    const limiter = new SlidingWindowLimiter()
    const w = [{ windowMs: MIN, max: 1 }]
    expect(limiter.hit([{ key: 'ai:a', windows: w }], 0).allowed).toBe(true)
    expect(limiter.hit([{ key: 'ai:b', windows: w }], 0).allowed).toBe(true)
    expect(limiter.hit([{ key: 'ocr:a', windows: w }], 0).allowed).toBe(true)
    expect(limiter.hit([{ key: 'ai:a', windows: w }], 0).allowed).toBe(false)
  })

  it('records a request in no bucket unless every bucket allows it', () => {
    const limiter = new SlidingWindowLimiter()
    const family = { key: 'fam', windows: [{ windowMs: MIN, max: 5 }] }
    const global = { key: 'global', windows: [{ windowMs: MIN, max: 1 }] }
    expect(limiter.hit([family, global], 0).allowed).toBe(true)
    for (let i = 0; i < 10; i++) expect(limiter.hit([family, global], 1).allowed).toBe(false)
    // the family bucket only holds the single allowed hit
    for (let i = 0; i < 4; i++) expect(limiter.hit([family], 2).allowed).toBe(true)
    expect(limiter.hit([family], 3).allowed).toBe(false)
  })

  it('evicts idle keys past capacity', () => {
    const limiter = new SlidingWindowLimiter(2)
    const w = [{ windowMs: MIN, max: 1 }]
    limiter.hit([{ key: 'a', windows: w }], 0)
    limiter.hit([{ key: 'b', windows: w }], 0)
    limiter.hit([{ key: 'c', windows: w }], 2 * MIN) // a and b are idle → evicted
    expect(limiter.hit([{ key: 'c', windows: w }], 2 * MIN).allowed).toBe(false)
    expect(limiter.hit([{ key: 'a', windows: w }], 2 * MIN).allowed).toBe(true)
  })
})

describe('measureInput', () => {
  it('counts string chars, scalars, keys; nested structures included', () => {
    expect(measureInput('héllo')).toBe(5)
    expect(measureInput({ a: 'xy', b: [1, true, null] })).toBe(1 + 2 + 1 + 1 + 3)
    expect(measureInput([['x'.repeat(10)]])).toBe(12)
  })

  it('stops early once over the cap and survives deep nesting', () => {
    let deep: unknown = 'x'
    for (let i = 0; i < 100_000; i++) deep = [deep]
    expect(measureInput(deep)).toBe(100_001)
    expect(measureInput({ big: 'x'.repeat(1_000_000) }, 10)).toBeGreaterThan(10)
  })
})
