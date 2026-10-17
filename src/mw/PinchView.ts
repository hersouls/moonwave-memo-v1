/* Moonwave UX — 모아서 보기 바꾸기 (데이터 뷰의 카드 ↔ 그리드)
   규격: https://ux.moonwave.kr/patterns/touch-gestures#pinch */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useGesture } from './gestures'
import { haptics } from './haptics'
import { pinchSteps } from './touch'
import { layoutTransition } from './viewTransition'
import type { ViewKind } from './ViewSwitch'

/** 촘촘한 차례예요: 카드(폰 1열) → 그리드(폰 2열). 표와 목록은 모으기로 바뀌지 않아요. */
const DENSITY: readonly ViewKind[] = ['card', 'grid']

export type UsePinchViewOptions = {
  /** 지금 보기예요(`useDataView`의 `state.view`). */
  value: ViewKind
  /** 보기를 바꿔요(`useDataView`의 `setView`). 보기 방식 칩과 같은 것을 불러요. */
  onChange: (view: ViewKind) => void
  /** 이 데이터 뷰가 주는 보기예요. 카드와 그리드가 둘 다 있어야 모으기가 걸려요. */
  views?: readonly ViewKind[]
}

/**
 * 데이터 뷰의 목록 위에서 두 손가락을 모으면 그리드(더 촘촘히), 벌리면 카드(더 크게)로 바꿔요. 바뀔 때 보이는 타일이 새 자리로 옮겨 가요.
 * 열 수는 키트의 너비 규칙을 따라요(카드 1 · 2 · 3열, 그리드 2 · 3 · 4열). 같은 일을 보기 방식 칩(ViewSwitch)으로 늘 할 수 있어요.
 * ‘모아서 보기 바꾸기’(파워)가 꺼져 있으면 붙이지 않아요. 켜져 있는 동안 이 목록 위에서는 브라우저 확대 대신 이것이 걸려요.
 */
export function usePinchView(ref: RefObject<HTMLElement | null>, { value, onChange, views = ['table', 'card', 'grid'] }: UsePinchViewOptions) {
  const on = useGesture('pinchView') && DENSITY.every((v) => views.includes(v))
  const latest = useRef({ value, onChange })
  useLayoutEffect(() => { latest.current = { value, onChange } })
  useEffect(() => {
    const node = ref.current
    if (!node || !on) return
    return pinchSteps(node, {
      onPinch: (dir) => {
        const { value: now, onChange: set } = latest.current
        const i = DENSITY.indexOf(now)
        if (i < 0) return
        const next = DENSITY[i + (dir === 'in' ? 1 : -1)]
        if (!next) { haptics.edge(); return }
        haptics.select()
        void layoutTransition(node, () => set(next))
      },
    })
  }, [ref, on])
}
