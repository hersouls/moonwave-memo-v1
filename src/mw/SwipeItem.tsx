/* Moonwave UX — SwipeItem (손짓을 받는 목록 줄 · 카드)
   한 항목의 행동 목록 하나로 네 길을 함께 열어요: 옆으로 밀기, 길게 누르기, ⋯ 버튼, 오른쪽 클릭. 즐겨찾기가 있으면 두 번 탭도요.
   손짓은 설정의 손짓 단계를 따르고, 꺼진 손짓은 붙이지 않아요. ⋯ 버튼은 어느 단계에서나 있어요.
   규격: https://ux.moonwave.kr/patterns/touch-gestures#swipe */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { ActionMenu } from './ActionMenu'
import type { ItemAction } from './ActionMenu'
import { Button } from './Button'
import { cx } from './cx'
import { hintSeen, markHint, reducedMotion } from './gesture-settings'
import type { SwipeAction } from './gesture-settings'
import { useGesture, useGestureSettings } from './gestures'
import { haptics } from './haptics'
import { IcFillHeart, IcLineArrowUp, IcLineHeart, IcLineMore, IcMwArrowDown } from './icons'
import { Popup, PopupBody, PopupContent, PopupFooter, PopupTitle } from './Popup'
import { doubleTap, swipeRow } from './touch'
import type { SwipeRest, SwipeRowControl, SwipeSide } from './touch'
import { useLongPress } from './useLongPress'

export type { ItemAction }
export { itemActions } from './ActionMenu'

/** 줄 끝의 행동 줄에 놓는 순서예요(앞이 바깥쪽). 설정에서 고른 것이 늘 맨 바깥이에요. */
const LEFT_ORDER: readonly SwipeAction[] = ['delete', 'archive', 'share', 'pin', 'done']
const RIGHT_ORDER: readonly SwipeAction[] = ['done', 'pin', 'archive', 'share', 'delete']
/** 왼쪽으로 밀 때 함께 드러나는 행동은 셋까지예요. 더 많은 것은 ⋯ 메뉴에 있어요. */
const TRAY_MAX = 3

/** 순서를 바꿀 수 있는 목록(SortableList) 안의 줄이 받는 것이에요. */
export type SortSlot = {
  index: number
  count: number
  /** 이 줄을 그 차례로 옮겨요. */
  moveTo: (to: number) => void
  /** 끌어서 순서 바꾸기가 켜져 있어요. 길게 누르기는 목록이 받아요(들어 올리기). */
  dragging: boolean
}
export const SortSlotContext = createContext<SortSlot | null>(null)

type ItemControl = { label: string; openMenu: (anchor: HTMLElement) => void; menuOpen: boolean }
const ItemContext = createContext<ItemControl | null>(null)

/** 지금 열린 줄 하나예요. 다른 줄을 밀기 시작하면 닫혀요. */
let openRow: (() => void) | null = null

export type SwipeItemProps = {
  /** 항목의 이름이에요. 메뉴와 버튼의 이름이 돼요(`제주 여행 준비물 더 보기`). */
  label: string
  /** 이 항목에 할 수 있는 일이에요. `itemActions.done(…)` · `.pin` · `.archive` · `.share` · `.delete`, 그 밖의 일은 직접 적어요. */
  actions: readonly ItemAction[]
  /** 즐겨찾기예요. 주면 두 번 탭으로 켜고 끄고, 메뉴에도 들어가요. 줄 안의 하트 버튼은 서비스가 그대로 둬요. */
  favorite?: { on: boolean; toggle: () => void }
  /** 길게 눌렀을 때 메뉴 위에 먼저 보이는 내용(미리 보기)이에요. ‘길게 눌러 미리 보기’가 켜져 있을 때만 보여요. */
  preview?: ReactNode
  /** ⋯ 버튼을 어디에 둘지예요. `end`는 키트가 줄 끝에 두고, `none`은 안에 `<ItemMoreButton />`을 직접 둬요. */
  more?: 'end' | 'none'
  /** 줄을 감싸는 요소예요. 목록의 줄이면 `li`예요. */
  as?: 'li' | 'div' | 'article'
  /** 처음 한 번, 이 줄이 살짝 밀렸다 돌아오며 밀 수 있다고 알려 줘요. 목록의 첫 줄에만 줘요. */
  hint?: boolean
  /** 옆으로 밀기를 받을지예요. 여러 열의 그리드 타일처럼 옆으로 밀기가 어색한 곳은 `false`로 두고, 길게 누르기 · ⋯ · 두 번 탭만 받아요. */
  swipe?: boolean
  /** 끝까지 밀어 지우기 전에 물을 때의 제목이에요(설정에서 ‘지우기 전에 묻기’를 켰을 때). */
  confirmTitle?: string
  className?: string
  children: ReactNode
}

/**
 * 손짓을 받는 목록 줄이나 카드예요. 안의 내용은 서비스가 그리고, 키트는 행동 줄 · 메뉴 · 손짓을 붙여요.
 * - 옆으로 밀기(표준부터): 설정의 거리나 빠르기를 넘기면 행동 줄이 열려요. 왼쪽은 셋까지, 오른쪽은 하나예요.
 * - 끝까지 밀기(파워): 그쪽의 맨 바깥 행동을 바로 해요. 지우기 · 보관은 옆으로 밀려 나가요.
 * - 길게 누르기(기본부터), ⋯ 버튼(늘), 오른쪽 클릭(마우스): 모든 행동이 든 같은 메뉴예요.
 * - 두 번 탭(표준부터): 즐겨찾기를 켜고 꺼요.
 * 지우기 같은 되돌릴 수 있는 행동은 `useUndo`로 5초 동안 되돌릴 길을 줘요.
 */
export function SwipeItem({ label, actions, favorite, preview, more = 'end', as: Tag = 'div', hint = false, swipe = true, confirmTitle, className, children }: SwipeItemProps) {
  const { settings } = useGestureSettings()
  const swipeOn = useGesture('swipe') && swipe
  const menuOn = useGesture('menu')
  const favOn = useGesture('favorite') && !!favorite
  const fullOn = useGesture('fullSwipe')
  const peekOn = useGesture('peek')
  const slot = useContext(SortSlotContext)
  const root = useRef<HTMLElement | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const trayL = useRef<HTMLDivElement>(null)
  const trayR = useRef<HTMLDivElement>(null)
  const ctl = useRef<SwipeRowControl | null>(null)
  const pointer = useRef('mouse')
  const [rest, setRest] = useState<SwipeRest>('closed')
  const [armed, setArmed] = useState<SwipeSide | null>(null)
  const [menu, setMenu] = useState<{ at: { x: number; y: number } | null; anchor: HTMLElement | null } | null>(null)
  const [ask, setAsk] = useState<{ action: ItemAction; side: SwipeSide } | null>(null)
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([])

  // 밀기에 놓일 행동: 설정의 왼쪽 · 오른쪽이 맨 바깥이고, 왼쪽에는 나머지가 셋까지 더 놓여요
  const usable = actions.filter((a) => !a.disabled && a.kind)
  const kind = (k: SwipeAction) => usable.find((a) => a.kind === k)
  const rightOne = kind(settings.right) ?? RIGHT_ORDER.filter((k) => k !== settings.left).map(kind).find(Boolean)
  const leftFirst = kind(settings.left) ?? LEFT_ORDER.map(kind).find((a) => a && a !== rightOne)
  const left = leftFirst && leftFirst !== rightOne
    ? [leftFirst, ...LEFT_ORDER.map(kind).filter((a): a is ItemAction => !!a && a !== leftFirst && a !== rightOne)].slice(0, TRAY_MAX)
    : []
  const right = rightOne ? [rightOne] : []
  const sides = useRef({ left, right })
  useLayoutEffect(() => { sides.current = { left, right } })

  // 행동을 해요: 목록에서 빠지는 행동은 옆으로 밀어 낸 뒤에, 아니면 제자리로 돌린 뒤에
  const act = (a: ItemAction, side: SwipeSide | null) => {
    const c = ctl.current
    if (c && side && a.removes) {
      c.out(side)
      window.setTimeout(a.run, reducedMotion() ? 0 : 200)
    } else {
      c?.set('closed')
      setRest('closed')
      a.run()
    }
  }
  const settleFull = useRef<(side: SwipeSide) => void>(() => {})
  settleFull.current = (side: SwipeSide) => {
    const a = side === 'left' ? sides.current.left[0] : sides.current.right[0]
    if (!a) return
    if (a.kind === 'delete' && settings.confirmDelete) { setAsk({ action: a, side }); return }
    haptics.success()
    act(a, side)
  }

  // 밀기: 켜져 있고 행동이 있을 때만 붙여요
  const canSwipe = swipeOn && (left.length > 0 || right.length > 0)
  const full = useRef(fullOn)
  useLayoutEffect(() => { full.current = fullOn })
  useEffect(() => {
    const node = body.current
    if (!node || !canSwipe) return
    const close = () => { ctl.current?.set('closed'); setRest('closed') }
    const c = swipeRow(node, {
      tray: (side) => (side === 'left' ? trayL.current?.offsetWidth ?? 0 : trayR.current?.offsetWidth ?? 0),
      full: () => full.current,
      onStart: () => {
        if (openRow && openRow !== close) openRow()
        // 낮은 줄(68px 미만)에서는 행동 이름을 화면 읽기 프로그램에만 남겨요
        const el = root.current
        if (el) { if (el.offsetHeight < 68) el.setAttribute('data-compact', ''); else el.removeAttribute('data-compact') }
      },
      onArm: setArmed,
      onSettle: (to) => {
        if (typeof to === 'object') { settleFull.current(to.full); return }
        setRest(to)
        if (to === 'closed') { if (openRow === close) openRow = null } else openRow = close
      },
    })
    ctl.current = c
    return () => { if (openRow === close) openRow = null; c.destroy(); ctl.current = null }
  }, [canSwipe])

  // 열린 줄은 그 줄이 든 목록이 8px 넘게 스크롤되면 닫혀요(다른 곳의 스크롤은 상관없어요)
  useEffect(() => {
    const node = root.current
    if (rest === 'closed' || !node) return
    const at = new Map<EventTarget, number>()
    const where = (t: EventTarget) => (t === document ? document.scrollingElement?.scrollTop ?? 0 : (t as Element).scrollTop)
    const watch = (e: Event) => {
      const t = e.target
      if (!t || (t !== document && !(t instanceof Element && t.contains(node)))) return
      if (!at.has(t)) { at.set(t, where(t)); return }
      if (Math.abs(where(t) - (at.get(t) ?? 0)) > 8) { ctl.current?.set('closed'); setRest('closed') }
    }
    addEventListener('scroll', watch, { capture: true, passive: true })
    return () => removeEventListener('scroll', watch, { capture: true })
  }, [rest])

  // 두 번 탭: 즐겨찾기
  const fav = useRef(favorite)
  useLayoutEffect(() => { fav.current = favorite })
  useEffect(() => {
    const node = body.current
    if (!node || !favOn) return
    return doubleTap(node, {
      onDouble: (at) => {
        const f = fav.current
        if (!f) return
        const turningOn = !f.on
        f.toggle()
        haptics.tap()
        const box = root.current?.getBoundingClientRect()
        if (turningOn && box && !reducedMotion()) {
          const id = performance.now()
          setBursts((b) => [...b, { id, x: at.x - box.left, y: at.y - box.top }])
          window.setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 900)
        }
      },
    })
  }, [favOn])

  // 길게 누르기: 메뉴(순서를 바꾸는 목록 안에서는 목록이 받아요)
  const openMenu = (at: { x: number; y: number } | null, anchor: HTMLElement | null) => {
    ctl.current?.set('closed')
    setRest('closed')
    setMenu({ at, anchor })
  }
  useLongPress(root, { enabled: menuOn && !slot?.dragging, onPress: (p) => openMenu({ x: p.x, y: p.y }, null) })
  useEffect(() => {
    const node = root.current
    if (!node) return
    const fromList = (e: Event) => { const d = (e as CustomEvent<{ x: number; y: number }>).detail; openMenu(d ?? null, null) }
    node.addEventListener('mw-menu', fromList)
    return () => node.removeEventListener('mw-menu', fromList)
  }, [])

  // 처음 한 번: 살짝 밀렸다 돌아와요(움직임을 줄이면 GestureHint의 글이 대신해요)
  useEffect(() => {
    if (!hint || !swipeOn || !left.length || hintSeen('swipe') || reducedMotion()) return
    const node = root.current
    const t = window.setTimeout(() => {
      if (!node) return
      node.classList.add('mw-swipe--hint')
      markHint('swipe')
      window.setTimeout(() => node.classList.remove('mw-swipe--hint'), 1400)
    }, 700)
    return () => window.clearTimeout(t)
  }, [hint, swipeOn, left.length])

  const byMouse = (e: ReactMouseEvent) => {
    if (pointer.current !== 'mouse') { if (menuOn) e.preventDefault(); return }
    // 글자를 고치는 칸에서는 브라우저의 메뉴(붙여넣기 같은 것)를 그대로 둬요. 항목의 링크 위에서는 항목의 메뉴예요
    if ((e.target as Element).closest('input, textarea, [contenteditable]')) return
    e.preventDefault()
    openMenu({ x: e.clientX, y: e.clientY }, null)
  }
  const notePointer = (e: ReactPointerEvent) => { pointer.current = e.pointerType }

  // 메뉴에는 모든 행동과 즐겨찾기, 순서를 바꾸는 목록이면 옮기기가 들어가요
  const menuActions: ItemAction[] = [...actions]
  if (favorite) menuActions.splice(0, 0, { label: favorite.on ? '즐겨찾기에서 빼기' : '즐겨찾기에 담기', icon: favorite.on ? IcFillHeart : IcLineHeart, run: favorite.toggle })
  if (slot && slot.count > 1) {
    if (slot.index > 0) menuActions.push({ label: '위로 옮기기', icon: IcLineArrowUp, run: () => slot.moveTo(slot.index - 1) })
    if (slot.index < slot.count - 1) menuActions.push({ label: '아래로 옮기기', icon: IcMwArrowDown, run: () => slot.moveTo(slot.index + 1) })
  }
  const toneOf = (a?: ItemAction) => (!a ? undefined : a.tone ?? 'plain')
  const button = (a: ItemAction, side: SwipeSide) => (
    <button key={a.label} type="button" className={cx('mw-swipe__action', a.tone && `mw-swipe__action--${a.tone}`)} onClick={() => { haptics.tap(); act(a, side) }}>
      <span className="mw-swipe__circle"><a.icon size={20} /></span>
      <span className="mw-swipe__label">{a.label}</span>
    </button>
  )

  const setRoot = (el: HTMLElement | null) => { root.current = el }
  return (
    <Tag
      ref={setRoot}
      className={cx('mw-swipe', rest !== 'closed' && `mw-swipe--open-${rest}`, armed && `mw-swipe--armed-${armed}`, className)}
      data-swipe-left={canSwipe ? toneOf(left[0]) : undefined}
      data-swipe-right={canSwipe ? toneOf(right[0]) : undefined}
      onContextMenu={byMouse}
      onPointerDown={notePointer}
    >
      {canSwipe && right.length > 0 && (
        <div ref={trayR} className="mw-swipe__tray mw-swipe__tray--right" inert={rest !== 'right'}>{right.map((a) => button(a, 'right'))}</div>
      )}
      {canSwipe && left.length > 0 && (
        <div ref={trayL} className="mw-swipe__tray mw-swipe__tray--left" inert={rest !== 'left'}>{[...left].reverse().map((a) => button(a, 'left'))}</div>
      )}
      <ItemContext.Provider value={{ label, menuOpen: !!menu, openMenu: (anchor) => openMenu(null, anchor) }}>
        <div ref={body} className="mw-swipe__body">
          {children}
          {more === 'end' && <ItemMoreButton />}
        </div>
      </ItemContext.Provider>
      {bursts.map((b) => (
        <span key={b.id} className="mw-burst" style={{ left: b.x, top: b.y }} aria-hidden="true">
          <IcFillHeart size={48} /><i /><i /><i /><i /><i /><i />
        </span>
      ))}
      <ActionMenu open={!!menu} onClose={() => setMenu(null)} label={label} actions={menuActions} at={menu?.at} anchor={menu?.anchor}
        preview={peekOn && menu?.at ? preview : undefined} />
      <Popup open={!!ask} onOpenChange={(o) => { if (!o) { setAsk(null); ctl.current?.set('closed'); setRest('closed') } }} type="center" role="alertdialog" aria-modal="true" aria-label={confirmTitle ?? `${label} 지우기`}>
        <PopupContent>
          <PopupTitle>{confirmTitle ?? `${label}, 지울까요?`}</PopupTitle>
          <PopupBody>지운 뒤 5초 동안은 되돌릴 수 있어요.</PopupBody>
        </PopupContent>
        <PopupFooter>
          <Button variant="secondary" size="large" onClick={() => { setAsk(null); ctl.current?.set('closed'); setRest('closed') }}>취소</Button>
          <Button variant="primary" size="large" onClick={() => { const a = ask; setAsk(null); if (a) { haptics.success(); act(a.action, a.side) } }}>지우기</Button>
        </PopupFooter>
      </Popup>
    </Tag>
  )
}

export type ItemMoreButtonProps = { className?: string }

/** 항목의 ⋯ 버튼이에요(44 × 44px). SwipeItem 안 어디에 두든 그 항목의 메뉴를 열어요. 어느 손짓 단계에서나 있어요. */
export function ItemMoreButton({ className }: ItemMoreButtonProps) {
  const item = useContext(ItemContext)
  if (!item) return null
  return (
    <button type="button" className={cx('mw-icon-button mw-swipe__more', className)} aria-label={`${item.label} 더 보기`} aria-haspopup="menu" aria-expanded={item.menuOpen}
      onClick={(e) => { haptics.tap(); item.openMenu(e.currentTarget) }}>
      <IcLineMore size={20} />
    </button>
  )
}
