/* Moonwave UX — Sheet (앱 레이어의 시트: 더보기, 짧은 선택, 높이 단계가 있는 시트) */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { HTMLAttributes, KeyboardEvent, ReactNode, RefObject } from 'react'
import { useCloseRequest } from './close'
import { cx } from './cx'
import { useGesture } from './gestures'
import { haptics } from './haptics'
import { sheetDrag, sheetOffset, SHEET_DETENTS } from './touch'

export { SHEET_DETENTS }

/** 높이 단계의 이름이에요. 손잡이가 읽어 줘요. */
const DETENT_NAME: Record<string, string> = { '0.3': '낮게', '0.6': '중간', '1': '전체' }
const detentName = (d: number) => DETENT_NAME[String(d)] ?? `${Math.round(d * 100)}%`

export type SheetDragExtra = {
  /** 높이 단계예요(화면 높이에 대한 비율, 작은 것부터). */
  detents?: readonly number[]
  /** 지금 단계의 차례예요. */
  detent?: number
  /** 끌어서 단계를 옮겼을 때 불러요. */
  onDetent?: (index: number) => void
}

/**
 * 열려 있는 동안 시트를 끌어 닫거나 높이 단계를 옮기게 해요. `mw-sheet`와, 시트가 된 패널(`mw-app-panel`)에 써요.
 * `when`이 있으면 그 답이 참일 때만 끌려요: 패널은 600px 이하에서만 시트예요. 설정에서 ‘시트 끌기’를 끄면 붙이지 않아요.
 */
export function useSheetDrag(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void, when?: () => boolean, extra: SheetDragExtra = {}) {
  const on = useGesture('sheet')
  const close = useRef(onClose)
  const may = useRef(when)
  const step = useRef(extra)
  useLayoutEffect(() => { close.current = onClose; may.current = when; step.current = extra })
  const stepped = !!extra.detents
  useEffect(() => {
    const node = ref.current
    if (!node || !open || !on) return
    return sheetDrag(node, {
      onClose: () => close.current(),
      when: () => may.current?.() ?? true,
      detents: stepped ? step.current.detents : undefined,
      detent: () => step.current.detent ?? 0,
      onDetent: (i) => step.current.onDetent?.(i),
    })
  }, [ref, open, on, stepped])
}

export type SheetProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 열려 있는지 정해요. */
  open: boolean
  /** 닫아야 할 때 불러요: 가림막이나 손잡이를 눌렀을 때, 아래로 끌었을 때, Esc와 뒤로 가기. */
  onClose: () => void
  /** 시트의 이름이에요. 화면 읽기 프로그램이 읽어요. */
  label: string
  /**
   * 높이 단계예요. `SHEET_DETENTS`(낮게 30% · 중간 60% · 전체)를 넘기면 손잡이를 끌거나 눌러 높이를 바꿔요.
   * 넘기지 않으면 내용만큼의 한 단계예요(더보기처럼 짧은 시트).
   */
  detents?: readonly number[]
  /** 열 때의 단계(차례)예요. 기본은 가운데예요: 고르는 시트는 중간, 상세는 전체, 뒤 화면을 보며 쓰는 시트는 낮게로 열어요. */
  initialDetent?: number
  /** 단계가 바뀌면 불러요. */
  onDetentChange?: (index: number) => void
  /** 시트 안에 넣을 내용이에요. 스크롤되는 부분은 `mw-sheet__body`, 아래에 고정할 확인 버튼은 `mw-sheet__foot`에 넣어요. */
  children: ReactNode
}

/**
 * 좁은 화면의 아래에서 올라오는 시트예요. 더보기 메뉴와 짧은 선택에 써요.
 * 가림막 누르기, 손잡이, 아래로 끌기, Esc, 폰의 뒤로 가기로 닫혀요. 닫혀 있는 동안에는 포커스가 들어가지 않아요.
 * 높이 단계가 있으면 손잡이는 닫지 않고 높이를 바꿔요(누를 때마다 한 단계 위로, 맨 위에서는 처음으로. 화살표 키도 돼요).
 */
export function Sheet({ open, onClose, label, detents, initialDetent, onDetentChange, className, style, children, ...props }: SheetProps) {
  const sheet = useRef<HTMLDivElement>(null)
  const first = initialDetent ?? (detents ? Math.floor((detents.length - 1) / 2) : 0)
  const [detent, setDetent] = useState(first)
  const [wasOpen, setWasOpen] = useState(open)
  // 다시 열 때는 처음 단계로 열어요
  if (open !== wasOpen) { setWasOpen(open); if (open) setDetent(first) }
  const change = (i: number) => { setDetent(i); onDetentChange?.(i) }
  useCloseRequest(open, onClose)
  useSheetDrag(sheet, open, onClose, undefined, { detents, detent, onDetent: change })

  // 단계마다 시트가 아래로 내려가 있는 거리를 CSS(--mw-sheet-y)에 적어요. 화면 크기가 바뀌면 다시 재요.
  useLayoutEffect(() => {
    const node = sheet.current
    if (!node || !detents) return
    const place = () => node.style.setProperty('--mw-sheet-y', `${sheetOffset(node, detents, detent)}px`)
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [detents, detent, open])

  const grabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!detents) return
    const d = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = Math.max(0, Math.min(detents.length - 1, detent + d))
    if (next !== detent) { haptics.select(); change(next) }
  }
  const grab = detents
    ? { 'aria-label': `시트 높이 바꾸기, 지금 ${detentName(detents[detent])}`, onClick: () => { haptics.select(); change(detent >= detents.length - 1 ? 0 : detent + 1) }, onKeyDown: grabKey }
    : { 'aria-label': '닫기', onClick: onClose }
  return (
    <>
      <button type="button" className={cx('mw-scrim', open && 'mw-scrim--on')} aria-label="닫기" tabIndex={-1} onClick={onClose} />
      <div ref={sheet} className={cx('mw-sheet', detents && 'mw-sheet--detents', open && 'mw-sheet--open', className)} role="dialog" aria-modal="true" aria-label={label} inert={!open} style={style} {...props}>
        <button type="button" className="mw-sheet__grab" {...grab}><i /></button>
        {children}
      </div>
    </>
  )
}
