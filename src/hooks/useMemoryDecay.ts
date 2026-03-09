import { useMemo } from 'react'
import type { CSSProperties } from 'react'

interface MemoryDecayResult {
  style: CSSProperties
  isRecent: boolean
}

const prefersReducedMotion =
  typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

export function useMemoryDecay(updatedAt: string, enabled: boolean): MemoryDecayResult {
  return useMemo(() => {
    if (!enabled) {
      return { style: {}, isRecent: false }
    }

    const now = Date.now()
    const updated = new Date(updatedAt).getTime()
    if (isNaN(updated)) {
      return { style: {}, isRecent: false }
    }
    const daysSinceUpdate = (now - updated) / (1000 * 60 * 60 * 24)
    const decay = Math.min(Math.max(daysSinceUpdate / 90, 0), 1)
    const isRecent = daysSinceUpdate < 1

    const style: CSSProperties = {
      opacity: Math.max(0.5, 1 - decay * 0.5),
    }

    if (!prefersReducedMotion && decay > 0) {
      style.filter = `blur(${decay * 1.2}px)`
    }

    return { style, isRecent }
  }, [updatedAt, enabled])
}
