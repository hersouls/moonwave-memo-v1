import { useState, useRef, useCallback, useEffect } from 'react'

const BUFFER_SIZE = 20
const FAST_THRESHOLD_MS = 120
const BREATHING_TRIGGER_SECONDS = 5
const IDLE_TIMEOUT_MS = 3000

interface BreathingTypographyResult {
  isBreathing: boolean
  recordKeystroke: () => void
}

export function useBreathingTypography(enabled: boolean): BreathingTypographyResult {
  const [isBreathing, setIsBreathing] = useState(false)

  const bufferRef = useRef<number[]>([])
  const fastStartRef = useRef<number | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clean up idle timer on unmount
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current)
      }
    }
  }, [])

  const recordKeystroke = useCallback(() => {
    if (!enabled) return

    const now = performance.now()
    const buffer = bufferRef.current

    buffer.push(now)
    if (buffer.length > BUFFER_SIZE) {
      buffer.shift()
    }

    // Reset idle timer
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
    }
    idleTimerRef.current = setTimeout(() => {
      setIsBreathing(false)
      fastStartRef.current = null
    }, IDLE_TIMEOUT_MS)

    // Need at least 2 timestamps to compute intervals
    if (buffer.length < 2) return

    // Compute average interval between the last keystrokes
    let totalInterval = 0
    let count = 0
    for (let i = 1; i < buffer.length; i++) {
      totalInterval += buffer[i] - buffer[i - 1]
      count++
    }
    const avgInterval = totalInterval / count

    if (avgInterval < FAST_THRESHOLD_MS) {
      if (fastStartRef.current === null) {
        fastStartRef.current = now
      }
      const fastDuration = (now - fastStartRef.current) / 1000
      if (fastDuration >= BREATHING_TRIGGER_SECONDS) {
        setIsBreathing(true)
      }
    } else {
      fastStartRef.current = null
      setIsBreathing(false)
    }
  }, [enabled])

  if (!enabled) {
    return { isBreathing: false, recordKeystroke: () => {} }
  }

  return { isBreathing, recordKeystroke }
}
