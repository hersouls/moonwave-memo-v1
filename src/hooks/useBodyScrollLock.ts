import { useEffect, useRef } from 'react'

/**
 * Lock body scroll when `locked` is true.
 * Uses the position:fixed pattern required for iOS Safari
 * where overflow:hidden alone does not prevent background scrolling.
 */
export function useBodyScrollLock(locked: boolean) {
  const scrollYRef = useRef(0)

  useEffect(() => {
    if (!locked) return

    // Save current scroll position
    scrollYRef.current = window.scrollY

    // Lock body
    const { style } = document.body
    const prevPosition = style.position
    const prevTop = style.top
    const prevLeft = style.left
    const prevRight = style.right
    const prevOverflow = style.overflow

    style.position = 'fixed'
    style.top = `-${scrollYRef.current}px`
    style.left = '0'
    style.right = '0'
    style.overflow = 'hidden'

    return () => {
      // Restore body
      style.position = prevPosition
      style.top = prevTop
      style.left = prevLeft
      style.right = prevRight
      style.overflow = prevOverflow

      // Restore scroll position
      window.scrollTo(0, scrollYRef.current)
    }
  }, [locked])
}
