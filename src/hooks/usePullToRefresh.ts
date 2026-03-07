import { useState, useRef, useCallback } from 'react'
import { useDrag } from '@use-gesture/react'

const PULL_THRESHOLD = 80
const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const bind = useDrag(
    ({ active, movement: [, my], cancel }) => {
      if (!isTouchDevice || isRefreshing) {
        cancel()
        return
      }

      // Only activate when scrolled to top
      const scrollTop = containerRef.current?.scrollTop ?? window.scrollY
      if (scrollTop > 0) {
        setPullDistance(0)
        return
      }

      if (active) {
        setPullDistance(Math.max(0, my * 0.5)) // dampen the pull
      } else {
        if (my > PULL_THRESHOLD) {
          setIsRefreshing(true)
          setPullDistance(40) // hold at indicator height
          onRefresh().finally(() => {
            setIsRefreshing(false)
            setPullDistance(0)
          })
        } else {
          setPullDistance(0)
        }
      }
    },
    {
      axis: 'y',
      filterTaps: true,
      pointer: { touch: true },
    }
  )

  const reset = useCallback(() => {
    setPullDistance(0)
    setIsRefreshing(false)
  }, [])

  return { bind, pullDistance, isRefreshing, containerRef, reset }
}
