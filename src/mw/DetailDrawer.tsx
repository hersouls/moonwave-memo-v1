/* Moonwave UX — DetailDrawer (행 상세 서랍) · RowExpand (표 행 인라인 펼치기)
   규격: https://ux.moonwave.kr/patterns/data-view#expand */
import { useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { useCloseRequest } from './close'
import { cx } from './cx'
import { haptics } from './haptics'
import { IcLineChevronDown, IcLineChevronLeft, IcLineChevronRight, IcLineClose } from './icons'

export type DetailDrawerProps = {
  open: boolean
  onClose: () => void
  /** 서랍의 제목이에요. 보통 행의 이름이에요. */
  title: string
  /** 지금 몇 번째인지(0부터)와 전체 개수예요. 주면 이전 · 다음 버튼와 "3 / 12"가 나와요. */
  index?: number
  total?: number
  /** 이전 · 다음 행으로 옮겨 가요. 목록은 그대로 두고 서랍 안만 바뀌어요. */
  onStep?: (delta: -1 | 1) => void
  /** 맨 아래 버튼 줄이에요(수정하기 …). 주 행동은 하나만 둬요. */
  footer?: ReactNode
  children: ReactNode
  id?: string
}

/**
 * 오른쪽 서랍에 한 행의 전체 상세를 보여 줘요. 목록은 옆에 그대로 남아요(앱 셸의 패널이 내용을 밀어요).
 * 600px 이하에서는 시트가 아니라 전체 화면이에요. Esc와 폰의 뒤로 가기로 닫혀요.
 * 이전 · 다음에서 끝에 닿으면 버튼가 꺼지고 한 번 짧게 떨어요.
 */
export function DetailDrawer({ open, onClose, title, index, total, onStep, footer, children, id }: DetailDrawerProps) {
  const own = useId()
  const titleId = useId()
  const box = useRef<HTMLElement>(null)
  useCloseRequest(open, onClose)
  const paged = index !== undefined && total !== undefined && !!onStep
  const step = (d: -1 | 1) => {
    if (!paged) return
    const next = (index as number) + d
    if (next < 0 || next >= (total as number)) { haptics.edge(); return }
    haptics.select()
    onStep?.(d)
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('.mw-app-panel__body')?.scrollTo({ top: 0 }))
  }
  return (
    <>
      <button type="button" className={cx('mw-app-panel-scrim', open && 'mw-app-panel-scrim--on')} aria-label="상세 닫기" tabIndex={-1} onClick={onClose} />
      <aside ref={box} id={id ?? own} className={cx('mw-app-panel', 'mw-app-panel--full', open && 'mw-app-panel--open')} role="dialog" aria-modal="false" aria-labelledby={titleId} inert={!open}>
        <div className="mw-app-panel__head">
          {paged && (
            <div className="mw-app-panel__nav">
              <button type="button" className="mw-row-expand" aria-label="이전 항목" disabled={index === 0} onClick={() => step(-1)}><IcLineChevronLeft /></button>
              <span className="mw-app-panel__pos" aria-live="polite">{(index as number) + 1} / {total}</span>
              <button type="button" className="mw-row-expand" aria-label="다음 항목" disabled={index === (total as number) - 1} onClick={() => step(1)}><IcLineChevronRight /></button>
            </div>
          )}
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="mw-row-expand" aria-label="닫기" onClick={onClose}><IcLineClose /></button>
        </div>
        <div className="mw-app-panel__body">{children}</div>
        {footer && <div className="mw-app-panel__foot">{footer}</div>}
      </aside>
    </>
  )
}

export type RowExpandProps = {
  open: boolean
  onToggle: () => void
  /** 펼쳐지는 상세 줄의 id예요(aria-controls). */
  controls: string
  /** 어느 행인지 말해요(`오사카 3박 4일`). 버튼 이름이 `오사카 3박 4일 부가정보 펼치기`가 돼요. */
  label: string
}

/** 표 행 왼쪽의 caret이에요. 눌러서 아래에 짧은 부가정보를 펼쳐요. 행 전체의 클릭(상세 서랍)과는 따로 일해요. */
export function RowExpand({ open, onToggle, controls, label }: RowExpandProps) {
  return (
    <button
      type="button"
      className="mw-row-expand"
      aria-expanded={open}
      aria-controls={controls}
      aria-label={`${label} 부가정보 ${open ? '접기' : '펼치기'}`}
      onClick={(e) => { e.stopPropagation(); haptics.select(); onToggle() }}
    >
      <IcLineChevronDown />
    </button>
  )
}
