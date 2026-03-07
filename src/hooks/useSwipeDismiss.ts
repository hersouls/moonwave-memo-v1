import { useState, useCallback, useRef } from 'react'
import { useDrag } from '@use-gesture/react'

interface UseSwipeDismissOptions {
  onDismiss: () => void
  direction: 'down' | 'left'
  threshold?: number
  enabled?: boolean
}

export function useSwipeDismiss({
  onDismiss,
  direction,
  threshold = 100,
  enabled = true,
}: UseSwipeDismissOptions) {
  const [offset, setOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dismissedRef = useRef(false)

  const bind = useDrag(
    ({ active, movement: [mx, my], velocity: [vx, vy], cancel }) => {
      if (!enabled || dismissedRef.current) {
        cancel()
        return
      }

      const delta = direction === 'down' ? my : mx
      const vel = direction === 'down' ? vy : vx

      // Only allow drag in the dismiss direction
      if (direction === 'down' && my < 0) {
        setOffset(0)
        return
      }
      if (direction === 'left' && mx > 0) {
        setOffset(0)
        return
      }

      setIsDragging(active)

      if (active) {
        setOffset(delta)
      } else {
        const shouldDismiss =
          (direction === 'down' && (delta > threshold || vel > 0.5)) ||
          (direction === 'left' && (delta < -threshold || vel > 0.5))

        if (shouldDismiss) {
          dismissedRef.current = true
          onDismiss()
          // Reset after dismiss
          setTimeout(() => {
            setOffset(0)
            dismissedRef.current = false
          }, 300)
        } else {
          setOffset(0)
        }
      }
    },
    {
      axis: direction === 'down' ? 'y' : 'x',
      filterTaps: true,
      pointer: { touch: true },
    }
  )

  const progress = Math.min(Math.abs(offset) / threshold, 1)

  const reset = useCallback(() => {
    setOffset(0)
    setIsDragging(false)
    dismissedRef.current = false
  }, [])

  return { bind, offset, isDragging, progress, reset }
}
