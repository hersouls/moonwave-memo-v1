import { useState, useEffect } from 'react'
import { MemoList } from './MemoList'

export function MemosPage() {
  // JS-based desktop detection to avoid mounting MemoList twice
  // (MemosLayout already mounts its own MemoList on desktop)
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches
  )

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Desktop: MemosLayout renders MemoList directly, skip here
  if (isDesktop) return null

  return <MemoList />
}
