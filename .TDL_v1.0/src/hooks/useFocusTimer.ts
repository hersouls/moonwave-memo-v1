import { useEffect } from 'react'
import { useFocusStore } from '@/stores/focusStore'

/**
 * Drives the focus timer with a 1-second interval.
 * Mount this once (in App or FocusMode).
 */
export function useFocusTimer() {
  const isActive = useFocusStore((s) => s.isActive)
  const isRunning = useFocusStore((s) => s.isRunning)
  const tick = useFocusStore((s) => s.tick)

  useEffect(() => {
    if (!isActive || !isRunning) return

    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [isActive, isRunning, tick])
}
