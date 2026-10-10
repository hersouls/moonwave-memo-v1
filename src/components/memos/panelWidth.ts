/* 넓은 화면(1280px부터)에서 메모를 열면 왼쪽에 놓이는 목록 칸의 너비예요. 끌어서 바꾼 값을 이 기기에 기억해요.
   메모 화면의 틀(MemosLayout)과, 그 화면을 불러오는 동안의 모습(PageLoading)이 같은 값을 써요. */
import { useCallback, useState } from 'react'

export const LIST_MIN_W = 280
export const LIST_MAX_W = 600
const LIST_DEFAULT_W = 360
const STORAGE_KEY = 'memo-split-width'

export function usePanelWidth() {
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const n = Number(saved)
        if (n >= LIST_MIN_W && n <= LIST_MAX_W) return n
      }
    } catch { /* noop */ }
    return LIST_DEFAULT_W
  })

  const persist = useCallback((w: number) => {
    setWidth(w)
    try { localStorage.setItem(STORAGE_KEY, String(w)) } catch { /* noop */ }
  }, [])

  return [width, persist] as const
}
