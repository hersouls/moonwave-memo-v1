import type { ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="animate-in fade-in duration-150">
      {children}
    </div>
  )
}
