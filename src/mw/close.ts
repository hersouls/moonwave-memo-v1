/* Moonwave UX — 닫기 요청 (Esc, 폰의 뒤로 가기)
   규격: https://ux.moonwave.kr/patterns/app-shell#keys */
import { useEffect, useLayoutEffect, useRef } from 'react'

type Watcher = { onclose: (() => void) | null; destroy: () => void }

/**
 * 닫기 요청을 받으면 `onClose`를 불러요. 닫기 요청은 데스크톱의 Esc와 Android의 뒤로 가기(손짓 · 버튼)예요.
 * 떠 있는 것이 여럿이면 가장 나중에 뜬 것부터 하나씩 받아요. 돌려주는 함수를 부르면 그만 들어요.
 * 브라우저에 CloseWatcher가 없으면 Esc만 들어요.
 */
export function onCloseRequest(onClose: () => void): () => void {
  const Ctor = (globalThis as { CloseWatcher?: new () => Watcher }).CloseWatcher
  if (Ctor) {
    try {
      const watcher = new Ctor()
      watcher.onclose = () => onClose()
      return () => { watcher.onclose = null; watcher.destroy() }
    } catch { /* 만들지 못하면 아래의 Esc로 받아요 */ }
  }
  const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
  document.addEventListener('keydown', key)
  return () => document.removeEventListener('keydown', key)
}

/** 열려 있는 동안 닫기 요청을 들어요. 시트 · 패널 · 팝업처럼 화면 위에 뜨는 것에 써요. */
export function useCloseRequest(open: boolean, onClose: () => void) {
  // 부르는 쪽이 렌더마다 새 함수를 넘겨도 다시 듣지 않아요
  const close = useRef(onClose)
  useLayoutEffect(() => { close.current = onClose })
  useEffect(() => {
    if (!open) return
    return onCloseRequest(() => close.current())
  }, [open])
}
