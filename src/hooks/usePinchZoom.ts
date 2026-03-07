import { useState, useCallback, useRef } from 'react'

type ZoomLevel = 'compact' | 'normal' | 'expanded'

const ZOOM_LEVELS: ZoomLevel[] = ['compact', 'normal', 'expanded']

export function usePinchZoom() {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('normal')
  const lastDistance = useRef(0)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastDistance.current = Math.sqrt(dx * dx + dy * dy)
    }
  }, [])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length !== 2) return
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const distance = Math.sqrt(dx * dx + dy * dy)
      const diff = distance - lastDistance.current

      if (Math.abs(diff) > 50) {
        const currentIdx = ZOOM_LEVELS.indexOf(zoomLevel)
        if (diff > 0 && currentIdx < ZOOM_LEVELS.length - 1) {
          setZoomLevel(ZOOM_LEVELS[currentIdx + 1])
        } else if (diff < 0 && currentIdx > 0) {
          setZoomLevel(ZOOM_LEVELS[currentIdx - 1])
        }
        lastDistance.current = distance
      }
    },
    [zoomLevel]
  )

  const gridCols: Record<ZoomLevel, string> = {
    compact: 'grid-cols-2 @2xs:grid-cols-3 @sm:grid-cols-4 @lg:grid-cols-5 @xl:grid-cols-6',
    normal: 'grid-cols-1 @2xs:grid-cols-2 @sm:grid-cols-3 @lg:grid-cols-4 @xl:grid-cols-5',
    expanded: 'grid-cols-1 @2xs:grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4',
  }

  return {
    zoomLevel,
    gridColsClass: gridCols[zoomLevel],
    handleTouchStart,
    handleTouchMove,
  }
}
