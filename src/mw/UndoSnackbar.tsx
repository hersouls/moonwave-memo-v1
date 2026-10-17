/* Moonwave UX — UndoSnackbar (지운 것 되돌리기: 5초 동안 ‘실행 취소’)
   규격: https://ux.moonwave.kr/patterns/touch-gestures#undo */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { haptics } from './haptics'
import { Snackbar, SnackbarTextButton } from './Snackbar'

/** 되돌릴 수 있는 시간(ms)이에요. */
export const UNDO_MS = 5000

export type UndoOffer = {
  /** 무엇을 했는지 짧게: `메모를 지웠어요` · `3개를 지웠어요` · `보관했어요`. */
  message: string
  /** `실행 취소`를 누르면 불러요. 항목을 있던 자리로 돌려요. */
  undo: () => void
  /** 5초가 지나거나 다음 알림이 오면 불러요. 이때 서버에서 정말 지워요. */
  commit?: () => void
}

type Shown = UndoOffer & { id: number }

/**
 * 되돌릴 수 있는 행동 뒤에 5초 동안 `실행 취소`를 보여 줘요. 화면에 하나만 두고, `offer`로 알려요.
 * 다음 알림이 오면 앞의 것은 그때 끝나요(commit). 화면을 떠나도 끝나요.
 *
 * ```tsx
 * const undo = useUndo()
 * const remove = (memo: Memo) => {
 *   hide(memo.id)
 *   undo.offer({ message: '메모를 지웠어요', undo: () => show(memo.id), commit: () => api.remove(memo.id) })
 * }
 * return <>{list}{undo.snackbar}</>
 * ```
 */
export function useUndo(): { offer: (o: UndoOffer) => void; snackbar: ReactNode } {
  const [shown, setShown] = useState<Shown | null>(null)
  const [open, setOpen] = useState(false)
  const now = useRef<Shown | null>(null)
  const offer = useCallback((o: UndoOffer) => {
    now.current?.commit?.()
    const next = { ...o, id: performance.now() }
    now.current = next
    setShown(next)
    setOpen(true)
  }, [])
  const undo = useCallback(() => {
    const o = now.current
    if (!o) return
    now.current = null
    haptics.tap()
    o.undo()
    setOpen(false)
  }, [])
  // 사라지는 움직임이 끝났어요: 되돌리지 않았으면 이제 끝내요
  const done = useCallback(() => {
    const o = now.current
    if (o && o.id === shown?.id) { now.current = null; o.commit?.() }
    setShown(null)
  }, [shown])
  useEffect(() => () => { now.current?.commit?.() }, [])
  // 알림 자리(role="status")는 늘 있어야 화면 읽기 프로그램이 새 글을 읽어요
  const snackbar = (
    <div className="mw-undo" role="status" aria-live="polite">
      {shown && <UndoSnackbar key={shown.id} message={shown.message} open={open} onUndo={undo} onDone={done} />}
    </div>
  )
  return { offer, snackbar }
}

export type UndoSnackbarProps = {
  message: string
  open: boolean
  onUndo: () => void
  /** 5초가 지나 사라졌거나, 되돌려서 사라진 뒤에 불러요. */
  onDone: () => void
}

/** 되돌리기 알림 하나예요. 보통은 `useUndo`가 화면 아래, 하단 탭과 주 행동 위의 자리(`mw-undo`)에 그려요. */
export function UndoSnackbar({ message, open, onUndo, onDone }: UndoSnackbarProps) {
  return (
    <Snackbar type="action" message={message} open={open} duration={UNDO_MS} onClose={onDone}
      actionElement={<SnackbarTextButton onClick={onUndo}>실행 취소</SnackbarTextButton>} />
  )
}
