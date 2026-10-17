/* Moonwave UX — GestureHint (처음 한 번만 보이는 손짓 안내)
   규격: https://ux.moonwave.kr/patterns/touch-gestures#hint */
import { useState } from 'react'
import { cx } from './cx'
import { hintSeen, markHint } from './gesture-settings'
import type { GestureId } from './gesture-settings'
import { useGesture, useReducedMotion } from './gestures'
import { IcLineInfo } from './icons'

/** 손짓마다의 처음 안내 문구예요. 서비스는 `children`으로 자기 말로 바꿀 수 있어요. */
const TEXT: Partial<Record<GestureId, string>> = {
  swipe: '항목을 왼쪽으로 밀면 지우기 · 보관 · 공유가, 오른쪽으로 밀면 완료가 나와요.',
  menu: '항목을 길게 누르면 할 수 있는 일이 모두 나와요.',
  favorite: '카드를 두 번 탭하면 즐겨찾기에 담겨요.',
  pinchView: '목록 위에서 두 손가락을 모으면 그리드, 벌리면 카드로 보여요.',
  reorder: '항목을 길게 누른 채 위아래로 끌면 순서가 바뀌어요.',
  tabSwipe: '아래의 탭 줄을 옆으로 밀면 옆 탭으로 가요.',
  zoom: '두 손가락을 벌리거나 두 번 탭하면 크게 보여요.',
}

export type GestureHintProps = {
  /** 어느 손짓의 안내인지예요. 그 손짓이 꺼져 있으면 보이지 않아요. */
  gesture: GestureId
  /** 안내 문구예요. 없으면 키트의 문구를 써요. */
  children?: string
  /**
   * 밀기의 첫 안내는 줄이 살짝 밀렸다 돌아오는 움직임이에요(SwipeItem의 `hint`). 그래서 글은 움직임을 줄인 사람에게만 보여요.
   * `always`를 주면 움직임과 상관없이 글을 보여요.
   */
  always?: boolean
  className?: string
}

/**
 * 손짓 하나를 처음 한 번만 한 줄 글로 알려 줘요. `알겠어요`를 누르면 다시 보이지 않아요(이 기기에 기억해요).
 * 설정의 ‘안내 다시 보기’를 누르면 다시 보여요. 목록 바로 위에 둬요.
 */
export function GestureHint({ gesture, children, always = false, className }: GestureHintProps) {
  const on = useGesture(gesture)
  const still = useReducedMotion()
  const [seen, setSeen] = useState(() => hintSeen(gesture))
  // 밀기는 움직임으로 먼저 알려요: 그 움직임을 볼 수 없는 사람에게만 글로 알려요
  const show = on && !seen && (always || gesture !== 'swipe' || still)
  if (!show) return null
  const text = children ?? TEXT[gesture] ?? ''
  return (
    <div className={cx('mw-gesture-hint', className)} role="note">
      <IcLineInfo size={20} />
      <span>{text}</span>
      <button type="button" className="mw-gesture-hint__ok" onClick={() => { markHint(gesture); setSeen(true) }}>알겠어요</button>
    </div>
  )
}
