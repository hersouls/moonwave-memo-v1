/* Moonwave UX — ActionMenu (항목의 행동 메뉴: ⋯ 버튼, 길게 누르기, 오른쪽 클릭이 여는 같은 메뉴)
   폰(600px 이하이거나 손가락으로 쓰는 기기)에서는 아래에서 올라오는 시트, 넓은 화면에서는 누른 자리 옆의 메뉴예요.
   규격: https://ux.moonwave.kr/patterns/touch-gestures#press */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { ComponentType, KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useCloseRequest } from './close'
import { cx } from './cx'
import type { SwipeAction } from './gesture-settings'
import { haptics } from './haptics'
import { IcLinePin, IcLineShare, IcLineTrash, IcMwArchive, IcMwCheckCircle } from './icons'
import type { IconProps } from './icons'
import { Sheet } from './Sheet'

/** 항목 하나에 할 수 있는 일이에요. 밀기 · 길게 누르기 · ⋯ 메뉴 · 오른쪽 클릭이 모두 같은 목록을 써요. */
export type ItemAction = {
  /** 밀기에 놓일 수 있는 행동이면 그 종류예요. 설정의 ‘밀기 동작’이 이 종류로 왼쪽 · 오른쪽을 골라요. */
  kind?: SwipeAction
  /** 메뉴와 버튼의 이름이에요. 동사로 짧게 써요: `보관`, `지우기`, `읽음으로 표시`. */
  label: string
  icon: ComponentType<IconProps>
  run: () => void
  /** 항목이 목록에서 빠지는 행동이에요(지우기 · 보관). 끝까지 밀면 옆으로 밀려 나가요. */
  removes?: boolean
  /** `danger`는 위험 색(지우기), `accent`는 강조 색(완료 · 고정)이에요. 없으면 중립이에요. */
  tone?: 'danger' | 'accent'
  /** 지금 할 수 없으면 참이에요. 메뉴에서 흐리게 보이고 밀기에는 놓이지 않아요. */
  disabled?: boolean
}

/** 자주 쓰는 다섯 행동이에요. 이름과 아이콘이 서비스마다 같아요. */
export const itemActions = {
  done: (run: () => void, label = '완료'): ItemAction => ({ kind: 'done', label, icon: IcMwCheckCircle, run, tone: 'accent' }),
  pin: (run: () => void, pinned = false): ItemAction => ({ kind: 'pin', label: pinned ? '고정 풀기' : '고정', icon: IcLinePin, run, tone: 'accent' }),
  archive: (run: () => void): ItemAction => ({ kind: 'archive', label: '보관', icon: IcMwArchive, run, removes: true }),
  share: (run: () => void): ItemAction => ({ kind: 'share', label: '공유', icon: IcLineShare, run }),
  delete: (run: () => void): ItemAction => ({ kind: 'delete', label: '지우기', icon: IcLineTrash, run, removes: true, tone: 'danger' }),
}

/** 메뉴가 폰의 시트로 열리는지예요. */
export function menuAsSheet(): boolean {
  try { return matchMedia('(max-width: 600px), (pointer: coarse)').matches } catch { return true }
}

export type ActionMenuProps = {
  open: boolean
  onClose: () => void
  /** 어느 항목의 메뉴인지예요(`제주 여행 준비물`). 메뉴의 이름이 `제주 여행 준비물 메뉴`가 돼요. */
  label: string
  actions: readonly ItemAction[]
  /** 넓은 화면에서 메뉴가 놓일 자리예요: 누른 자리(오른쪽 클릭)나 ⋯ 버튼. */
  at?: { x: number; y: number } | null
  anchor?: HTMLElement | null
  /** 메뉴 위에 먼저 보이는 내용(미리 보기)이에요. 폰의 시트에서만 보여요. */
  preview?: ReactNode
}

/**
 * 항목의 행동을 모아 보여 줘요. 폰에서는 시트(행동마다 아이콘과 이름이 있는 줄), 넓은 화면에서는 작은 메뉴예요.
 * 메뉴는 화살표 키 · Home · End로 옮겨 다니고, Esc와 뒤로 가기, 바깥 누르기로 닫혀요. 닫히면 열었던 곳으로 포커스가 돌아가요.
 * 열려 있을 때만 그려요(목록의 줄마다 하나씩 두어도 닫힌 메뉴는 화면에 없어요). `document.body`에 그려요.
 */
export function ActionMenu(props: ActionMenuProps) {
  const [sheet] = useState(menuAsSheet)
  const [live, setLive] = useState(props.open)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (props.open) {
      setLive(true)
      // 닫힌 자리에 한 번 그린 다음 열어야 올라오는 움직임이 보여요
      let inner = 0
      const outer = requestAnimationFrame(() => { inner = requestAnimationFrame(() => setShown(true)) })
      return () => { cancelAnimationFrame(outer); cancelAnimationFrame(inner) }
    }
    setShown(false)
    const t = setTimeout(() => setLive(false), 420)
    return () => clearTimeout(t)
  }, [props.open])
  if (!live) return null
  // 폰의 시트는 화면 맨 위 층(document.body)에, 넓은 화면의 메뉴는 그 항목 곁(본문의 랜드마크 안)에 그려요
  const body = <MenuBody {...props} open={shown && props.open} sheet={sheet} />
  return sheet ? createPortal(body, document.body) : body
}

function MenuBody({ open, onClose, label, actions, at, anchor, preview, sheet }: ActionMenuProps & { sheet: boolean }) {
  const back = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) { back.current = document.activeElement as HTMLElement | null; return }
    const el = back.current
    back.current = null
    if (el && el.isConnected) el.focus({ preventScroll: true })
  }, [open])
  const run = (a: ItemAction) => {
    if (a.disabled) return
    haptics.tap()
    onClose()
    a.run()
  }
  if (sheet) {
    return (
      <Sheet open={open} onClose={onClose} label={`${label} 메뉴`}>
        {preview && open && <div className="mw-peek">{preview}</div>}
        <div className="mw-sheet__body mw-action-sheet">
          {actions.map((a) => (
            <button key={a.label} type="button" className={cx('mw-sheet__item', a.tone === 'danger' && 'mw-sheet__item--danger')} disabled={a.disabled} onClick={() => run(a)}>
              <span className="mw-sheet__icon"><a.icon size={24} /></span>
              <span><b>{a.label}</b></span>
            </button>
          ))}
        </div>
      </Sheet>
    )
  }
  return open ? <MenuPopover label={label} actions={actions} at={at} anchor={anchor} onClose={onClose} onRun={run} /> : null
}

function MenuPopover({ label, actions, at, anchor, onClose, onRun }: { label: string; actions: readonly ItemAction[]; at?: { x: number; y: number } | null; anchor?: HTMLElement | null; onClose: () => void; onRun: (a: ItemAction) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const id = useId()
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  useCloseRequest(true, onClose)

  // 누른 자리나 버튼 아래에 두되 화면 밖으로 나가지 않게 해요
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const r = anchor?.getBoundingClientRect()
    const want = at ?? (r ? { x: r.right, y: r.bottom + 4 } : { x: innerWidth / 2, y: innerHeight / 3 })
    const w = el.offsetWidth, h = el.offsetHeight, pad = 8
    let left = at ? want.x : want.x - w
    let top = want.y
    if (top + h > innerHeight - pad) top = Math.max(pad, (r && !at ? r.top - 4 : want.y) - h)
    left = Math.max(pad, Math.min(left, innerWidth - w - pad))
    setPos({ left, top })
  }, [at, anchor])
  // 자리를 잡아 보이게 된 뒤에 첫 항목으로 포커스를 옮겨요(보이지 않는 것에는 포커스가 가지 않아요)
  useEffect(() => {
    if (pos) box.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not([disabled])')?.focus({ preventScroll: true })
  }, [pos])

  // 바깥을 누르면 닫혀요
  useEffect(() => {
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('pointerdown', away, true)
    return () => document.removeEventListener('pointerdown', away, true)
  }, [onClose])

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(box.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? [])
    const i = items.indexOf(document.activeElement as HTMLButtonElement)
    const go = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1 : null
    if (go === null) { if (e.key === 'Tab') onClose(); return }
    e.preventDefault()
    items[(go + items.length) % items.length]?.focus()
  }

  return (
    <div ref={box} id={id} className="mw-action-menu" role="menu" aria-label={`${label} 메뉴`} onKeyDown={keys}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      {actions.map((a) => (
        <button key={a.label} type="button" role="menuitem" className={cx('mw-action-menu__item', a.tone === 'danger' && 'mw-action-menu__item--danger')} disabled={a.disabled} onClick={() => onRun(a)}>
          <a.icon size={20} />{a.label}
        </button>
      ))}
    </div>
  )
}
