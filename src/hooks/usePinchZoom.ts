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

  // 칸 수는 카드 한 장의 가장 좁은 너비로 정해져요(.memo-grid, index.css): 목록이 놓인 자리의 너비를 그대로 따라가요.
  // 예전에는 컨테이너 쿼리(@sm …)로 칸 수를 적었는데, 그 기준이 목록이 아니라 내용 영역 전체여서 폰에서 세 칸으로 찌그러졌어요.
  const gridClass = `memo-grid memo-grid--${zoomLevel}`

  return {
    zoomLevel,
    gridClass,
    handleTouchStart,
    handleTouchMove,
  }
}
