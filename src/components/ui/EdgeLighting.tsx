import { useEffect, useState } from 'react'
import { create } from 'zustand'

// ─── Store ────────────────────────────────────────
type EdgeLightColor = 'blue' | 'green' | 'amber' | 'purple' | 'red'

interface EdgeLightingState {
  isActive: boolean
  color: EdgeLightColor
  trigger: (color?: EdgeLightColor) => void
}

export const useEdgeLightingStore = create<EdgeLightingState>((set) => ({
  isActive: false,
  color: 'blue',
  trigger: (color = 'blue') => {
    set({ isActive: true, color })
    setTimeout(() => set({ isActive: false }), 1600)
  },
}))

// ─── Component ────────────────────────────────────
export function EdgeLighting() {
  const isActive = useEdgeLightingStore((s) => s.isActive)
  const color = useEdgeLightingStore((s) => s.color)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isActive) {
      setVisible(true)
      const timer = setTimeout(() => setVisible(false), 1500)
      return () => clearTimeout(timer)
    }
  }, [isActive])

  if (!visible) return null

  return (
    <div
      className={`edge-lighting edge-lighting--${color}`}
      aria-hidden="true"
    />
  )
}
