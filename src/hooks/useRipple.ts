import { useCallback } from 'react'

export function useRipple() {
  const createRipple = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const ripple = document.createElement('span')

    ripple.style.cssText = `
      position: absolute;
      border-radius: 50%;
      width: ${size}px;
      height: ${size}px;
      left: ${e.clientX - rect.left - size / 2}px;
      top: ${e.clientY - rect.top - size / 2}px;
      background: currentColor;
      opacity: 0.1;
      transform: scale(0);
      pointer-events: none;
      animation: ripple 0.4s ease-out;
    `

    // Ensure parent has correct positioning
    const pos = getComputedStyle(el).position
    if (pos === 'static') {
      el.style.position = 'relative'
    }
    el.style.overflow = 'hidden'

    el.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove())
  }, [])

  return { createRipple }
}
