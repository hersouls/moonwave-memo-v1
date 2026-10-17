/* Moonwave UX — Pull Refresh (당겨서 새로 고침) */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useGesture } from './gestures'
import { pullRefresh } from './touch'

export type PullRefreshProps = {
  /** 세로로 스크롤되는 내용(`mw-app-content`)을 가리켜요. */
  scroller: RefObject<HTMLElement | null>
  /** 당겼다 놓으면 불러요. 약속(Promise)을 돌려주면 끝날 때까지 동그라미가 돌아요. 넘기지 않으면 화면을 다시 받아요. */
  onRefresh?: () => void | Promise<unknown>
}

/**
 * 손가락으로 쓰는 기기에서, 내용이 맨 위에 있을 때 아래로 당기면 새로 고쳐요.
 * 본문(`mw-app-main`) 안, 내용(`mw-app-content`) 옆에 한 번 둬요. 내려오는 동그라미를 스스로 그려요.
 * 설정의 손짓 단계에서 ‘당겨서 새로 고침’을 끄면 붙이지 않아요. 새로 고침 버튼은 어느 단계에서나 둬요.
 */
export function PullRefresh({ scroller, onRefresh }: PullRefreshProps) {
  const mark = useRef<HTMLDivElement>(null)
  const run = useRef(onRefresh)
  const on = useGesture('pull')
  useLayoutEffect(() => { run.current = onRefresh })
  useEffect(() => {
    const node = scroller.current
    if (!node || !on) return
    return pullRefresh(node, { indicator: mark.current, onRefresh: () => (run.current ? run.current() : location.reload()) })
  }, [scroller, on])
  return (
    <div ref={mark} className="mw-pull" aria-hidden="true"><i className="mw-pull__ring" /></div>
  )
}
