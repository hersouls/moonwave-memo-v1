/* Moonwave UX — 탭 줄 밀기 (하단 탭 · 고정 탭에서 옆 탭으로)
   규격: https://ux.moonwave.kr/patterns/touch-gestures#tabs */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useGesture } from './gestures'
import { haptics } from './haptics'
import { tabSwipe } from './touch'

export type UseTabSwipeOptions = {
  /** 지금 탭의 차례예요(0부터). */
  index: number
  /** 탭의 수예요. */
  count: number
  /** 옆 탭으로 가요. 탭을 누른 것과 같은 일을 해요. */
  onChange: (index: number) => void
}

/**
 * 하단 탭 줄(`mw-app-tabbar`)이나 고정 탭(`mw-tab-group--fixed`)을 옆으로 밀면 옆 탭으로 가요. 왼쪽으로 밀면 다음, 오른쪽은 이전이에요.
 * 끝에서는 더 가지 않고 짧게 떨어요. 옆으로 스크롤되는 탭 줄에는 붙이지 않아요(그 줄의 밀기는 스크롤이에요).
 * ‘탭 줄 밀기’(파워)가 꺼져 있으면 붙이지 않아요.
 */
export function useTabSwipe(ref: RefObject<HTMLElement | null>, { index, count, onChange }: UseTabSwipeOptions) {
  const on = useGesture('tabSwipe')
  const latest = useRef({ index, count, onChange })
  useLayoutEffect(() => { latest.current = { index, count, onChange } })
  useEffect(() => {
    const node = ref.current
    if (!node || !on) return
    return tabSwipe(node, {
      onSwipe: (step) => {
        const { index: i, count: n, onChange: go } = latest.current
        const next = i + step
        if (next < 0 || next >= n) { haptics.edge(); return }
        haptics.select()
        go(next)
      },
    })
  }, [ref, on])
}
