import { useState, useEffect, useCallback, useRef } from 'react'
import type { Memo } from '@/lib/types'
import { useMemoStore } from '@/stores/memoStore'
import { findBestContextMemo } from '@/services/contextMatcher'

const DISMISS_KEY = 'memo-context-surfacing-dismissed'
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return false
    const ts = Number(raw)
    return Date.now() - ts < DISMISS_TTL_MS
  } catch {
    return false
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch { /* storage full */ }
}

export function useContextSurfacing(enabled: boolean) {
  const [suggestedMemo, setSuggestedMemo] = useState<Memo | null>(null)
  const memos = useMemoStore((s) => s.memos)
  const hasRunRef = useRef(false)
  const memosRef = useRef(memos)
  memosRef.current = memos

  // Run once on mount (5s delay), not on every memos change
  useEffect(() => {
    if (!enabled || isDismissedRecently() || hasRunRef.current) {
      if (!enabled) setSuggestedMemo(null)
      return
    }

    const timer = setTimeout(() => {
      hasRunRef.current = true
      const best = findBestContextMemo(memosRef.current)
      setSuggestedMemo(best)
    }, 5000)

    return () => clearTimeout(timer)
  }, [enabled])

  const dismiss = useCallback(() => {
    setSuggestedMemo(null)
    markDismissed()
  }, [])

  return { suggestedMemo, dismiss }
}
