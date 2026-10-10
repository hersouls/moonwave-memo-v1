/* Moonwave UX — Sheet (앱 레이어의 시트: 더보기, 짧은 선택) */
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { HTMLAttributes, ReactNode, RefObject } from 'react'
import { useCloseRequest } from './close'
import { cx } from './cx'
import { sheetDrag } from './touch'

/**
 * 열려 있는 동안 시트를 아래로 끌어 닫게 해요. `mw-sheet`와, 시트가 된 패널(`mw-app-panel`)에 써요.
 * `when`이 있으면 그 답이 참일 때만 끌려요: 패널은 600px 이하에서만 시트예요.
 */
export function useSheetDrag(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, when?: () => boolean) {
  const close = useRef(onClose)
  const may = useRef(when)
  useLayoutEffect(() => { close.current = onClose; may.current = when })
  useEffect(() => {
    const node = ref.current
    if (!node || !open) return
    return sheetDrag(node, { onClose: () => close.current(), when: () => may.current?.() ?? true })
  }, [ref, open])
}

export type SheetProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 열려 있는지 정해요. */
  open: boolean
  /** 닫아야 할 때 불러요: 가림막이나 손잡이를 눌렀을 때, 아래로 끌었을 때, Esc와 뒤로 가기. */
  onClose: () => void
  /** 시트의 이름이에요. 화면 읽기 프로그램이 읽어요. */
  label: string
  /** 시트 안에 넣을 내용이에요. 스크롤되는 부분은 `mw-sheet__body`에 넣어요. */
  children: ReactNode
}

/**
 * 좁은 화면의 아래에서 올라오는 시트예요. 더보기 메뉴와 짧은 선택에 써요.
 * 가림막 누르기, 손잡이, 아래로 끌기, Esc, 폰의 뒤로 가기로 닫혀요. 닫혀 있는 동안에는 포커스가 들어가지 않아요.
 */
export function Sheet({ open, onClose, label, className, children, ...props }: SheetProps) {
  const sheet = useRef<HTMLDivElement>(null)
  useCloseRequest(open, onClose)
  useSheetDrag(sheet, open, onClose)
  return (
    <>
      <button type="button" className={cx('mw-scrim', open && 'mw-scrim--on')} aria-label="닫기" tabIndex={-1} onClick={onClose} />
      <div ref={sheet} className={cx('mw-sheet', open && 'mw-sheet--open', className)} role="dialog" aria-modal="true" aria-label={label} inert={!open} {...props}>
        <button type="button" className="mw-sheet__grab" aria-label="닫기" onClick={onClose}><i /></button>
        {children}
      </div>
    </>
  )
}
