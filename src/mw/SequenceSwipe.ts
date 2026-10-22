/* Moonwave UX — 상세 제목 밀어 이전·다음 항목으로
   규격: https://ux.moonwave.kr/patterns/touch-gestures#tabs */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useGesture } from './gestures'
import { haptics } from './haptics'
import { tabSwipe } from './touch'

export type UseSequenceSwipeOptions = {
  /** 지금 항목의 차례예요(0부터). */
  index: number
  /** 항목의 수예요. */
  count: number
  /** 옆 항목으로 가요. 이전·다음 버튼과 같은 일을 해요. */
  onChange: (index: number) => void
}

/** 상세 제목·이전/다음 영역에 붙여요. 본문, 입력, 사진에는 붙이지 않아요.
 * 왼쪽으로 밀면 다음, 오른쪽은 이전이에요. sequenceSwipe(파워)가 꺼지면 이벤트를 붙이지 않아요.
 * 양끝과 화면 가장자리의 동작은 공통 touch 엔진을 따라요. 같은 일을 이전·다음 버튼으로도 해요.
 */
export function useSequenceSwipe(ref: RefObject<HTMLElement | null>, { index, count, onChange }: UseSequenceSwipeOptions) {
  const on = useGesture('sequenceSwipe') && count > 1
  const latest = useRef({ index, count, onChange })
  useLayoutEffect(() => { latest.current = { index, count, onChange } })
  useEffect(() => {
    const node = ref.current
    if (!node || !on) return
    const previous = node.style.touchAction
    node.style.touchAction = 'pan-y'
    const off = tabSwipe(node, {
      onSwipe: (step) => {
        const { index: i, count: n, onChange: go } = latest.current
        const next = i + step
        if (next < 0 || next >= n) { haptics.edge(); return }
        haptics.select()
        go(next)
      },
    })
    return () => { off(); node.style.touchAction = previous }
  }, [ref, on])
}
