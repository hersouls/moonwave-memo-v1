/* Moonwave UX — 길게 누르기
   규격: https://ux.moonwave.kr/patterns/touch-gestures#press */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { longPress } from './touch'
import type { PressAt } from './touch'

export type UseLongPressOptions = {
  /** 받아들여졌을 때 불러요(한 번 떨어요). 손가락은 아직 화면에 있어요. */
  onPress: (at: PressAt) => void
  /** 켜져 있는지예요. 꺼져 있으면 이벤트를 아예 붙이지 않아요. 보통 `useGesture('menu')`를 넘겨요. */
  enabled?: boolean
  /** 누르기를 시작하지 않는 곳이에요. */
  ignore?: string
}

/**
 * 요소를 손가락으로 길게 누르면(설정의 시간: 350 · 500 · 700ms) `onPress`를 불러요. 그 사이에 움직이면 취소해요.
 * 누르는 동안 iOS의 길게 누르기 메뉴와 글자 고르기는 나오지 않아요(`data-mw-press`, 키트의 CSS).
 */
export function useLongPress<T extends HTMLElement>(ref: RefObject<T | null>, { onPress, enabled = true, ignore }: UseLongPressOptions) {
  const run = useRef(onPress)
  useLayoutEffect(() => { run.current = onPress })
  useEffect(() => {
    const node = ref.current
    if (!node || !enabled) return
    return longPress(node, { onPress: (at) => run.current(at), ignore })
  }, [ref, enabled, ignore])
}
