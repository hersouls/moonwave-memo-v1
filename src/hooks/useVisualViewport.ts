import { useState, useEffect } from 'react'

interface VisualViewportState {
  viewportHeight: number
  isKeyboardOpen: boolean
  keyboardHeight: number
}

export function useVisualViewport(): VisualViewportState {
  const [state, setState] = useState<VisualViewportState>({
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    isKeyboardOpen: false,
    keyboardHeight: 0,
  })

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    const update = () => {
      const height = vv.height
      const isOpen = height < window.innerHeight * 0.75
      setState({
        viewportHeight: height,
        isKeyboardOpen: isOpen,
        keyboardHeight: isOpen ? window.innerHeight - height : 0,
      })
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return state
}
