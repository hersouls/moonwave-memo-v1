/* Moonwave UX — Expand (펼치기: 폰에서 접어 두었다가 눌러서 그 자리에 펼치는 곳. 넓은 화면에서는 늘 펼쳐져 있어요)
   규격: https://ux.moonwave.kr/components/expand */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, FocusEvent, HTMLAttributes, ReactNode, Ref } from 'react'
import { cx } from './cx'
import { haptics } from './haptics'
import { IcLineChevronDown } from './icons'
import type { IconProps } from './icons'

const KEY = 'mw:expand:'
const kept = (name?: string): boolean | null => {
  if (!name) return null
  try { const v = localStorage.getItem(KEY + name); return v === null ? null : v === '1' } catch { return null }
}
const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return true } }

export type UseExpandOptions = {
  /** 이름을 주면 펼친 상태를 이 기기에 기억해요. 서비스 이름을 앞에 붙여요(`calendar:groups`). */
  name?: string
  /** 처음 상태예요. 기억해 둔 것이 있으면 그것이 먼저예요. 기본은 접힘이에요. */
  defaultOpen?: boolean
  /** 펼침 상태예요. 주면 바깥에서 상태를 관리해요. */
  open?: boolean
  /** 펼침 상태가 바뀔 때 새 값을 넘겨 줘요. */
  onOpenChange?: (open: boolean) => void
}

export type ExpandControl = {
  /** 지금 펼쳐져 있는지예요. */
  open: boolean
  /** 펼치거나 접어요. */
  setOpen: (open: boolean) => void
  /** 반대로 바꿔요. 여는 버튼이 눌렸을 때 불러요(가볍게 떨려요). */
  toggle: () => void
  /** 앞부분만 보이는 곳(peek)에서 내용이 다 보이면 참이에요. 이때는 여는 버튼을 그리지 않아요. */
  fits: boolean
  /** 여는 버튼에 펼쳐 넣어요: `<FilterChip {...x.button}>` · `<ExpandButton {...x.button} more="더 보기" />`. 넓은 화면에서는 이 표시(data-expand-opener)가 버튼을 숨겨요. */
  button: { 'aria-expanded': boolean; 'aria-controls': string; 'data-expand-opener': ''; onClick: () => void }
  /** 펼쳐지는 곳에 펼쳐 넣어요: `<Expand {...x.region}>` */
  region: { id: string; open: boolean; live: boolean; onFits: (fits: boolean) => void; onReveal: () => void }
}

/**
 * 여는 버튼 하나와 펼쳐지는 곳 하나를 이어요. 돌려준 `button`과 `region`을 각각에 펼쳐 넣으면 돼요.
 * 버튼은 키트의 버튼이면 무엇이든 돼요(ExpandButton, FilterChip, 아이콘 버튼).
 * 접는 것은 폰(600px 이하)에서만이에요. 그보다 넓은 화면에서는 키트의 CSS가 늘 펼쳐 두고 여는 버튼을 숨겨요.
 */
export function useExpand({ name, defaultOpen = false, open: controlled, onOpenChange }: UseExpandOptions = {}): ExpandControl {
  const id = useId()
  const [inner, setInner] = useState(() => kept(name) ?? defaultOpen)
  // 손이 한 번이라도 여닫은 곳만 움직이며 열려요. 화면이 뜰 때부터 열려 있는 곳은 그냥 서 있어요.
  const [live, setLive] = useState(false)
  const [fits, setFits] = useState(false)
  const open = controlled ?? inner
  const setOpen = useCallback((next: boolean) => {
    setLive(true)
    if (controlled === undefined) setInner(next)
    if (name) { try { localStorage.setItem(KEY + name, next ? '1' : '0') } catch { /* 저장소를 쓸 수 없어요 */ } }
    onOpenChange?.(next)
  }, [controlled, name, onOpenChange])
  const toggle = useCallback(() => { haptics.select(); setOpen(!open) }, [open, setOpen])
  const onReveal = useCallback(() => setOpen(true), [setOpen])
  return { open, setOpen, toggle, fits, button: { 'aria-expanded': open, 'aria-controls': id, 'data-expand-opener': '', onClick: toggle }, region: { id, open, live, onFits: setFits, onReveal } }
}

// 가장 가까운 스크롤되는 곳에서 보이는 범위
const view = (el: Element) => {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight + 1) { const r = p.getBoundingClientRect(); return { top: r.top, bottom: r.bottom } }
  }
  return { top: 0, bottom: innerHeight }
}
const show = (el: Element) => el.scrollIntoView({ block: 'nearest', behavior: still() ? 'auto' : 'smooth' })

export type ExpandProps = Omit<HTMLAttributes<HTMLDivElement>, 'children'> & {
  /** 펼쳐져 있는지 정해요. */
  open: boolean
  /** 손이 여닫은 곳인지예요. `useExpand`가 넣어 줘요. 참일 때만 움직이며 열려요. */
  live?: boolean
  /** 접혀 있어도 앞부분을 보여요. `true`면 세 줄이고, 숫자를 주면 그만큼의 줄이에요. */
  peek?: boolean | number
  /** 여는 버튼과의 사이(8px)를 두지 않아요. */
  flush?: boolean
  /** 앞부분만 보이는 곳에서, 내용이 다 보이는지가 바뀔 때 불러요. `useExpand`가 넣어 줘요. */
  onFits?: (fits: boolean) => void
  /** 키보드가 가려진 부분으로 들어가서 펼쳐야 할 때 불러요. `useExpand`가 넣어 줘요. */
  onReveal?: () => void
  /** 펼쳐서 보여 줄 내용이에요. */
  children: ReactNode
  /** 펼쳐지는 곳(div)을 가리키는 ref예요. */
  ref?: Ref<HTMLDivElement>
}

/**
 * 폰에서 눌러서 그 자리에 펼쳐지는 곳이에요. 닫혀 있으면 화면에 없고, 열릴 때 아래 내용을 부드럽게 밀어요.
 * 펼친 것이 화면 아래로 넘어가면 보이는 곳으로 데려오고, 접어서 여는 버튼이 화면 밖에 남으면 버튼을 데려와요.
 * 넓은 화면에서는 `open`과 상관없이 늘 보여요. 그래서 내용은 닫혀 있어도 늘 그려 둬요.
 */
export function Expand({ open, live = false, peek = false, flush = false, onFits, onReveal, className, style, children, ref, ...props }: ExpandProps) {
  const node = useRef<HTMLDivElement | null>(null)
  const body = useRef<HTMLDivElement>(null)
  const [fits, setFits] = useState(false)
  const told = useRef(onFits)
  const last = useRef(false)
  const floor = useRef(0)
  useEffect(() => { told.current = onFits })
  const setRef = (el: HTMLDivElement | null) => {
    node.current = el
    if (typeof ref === 'function') ref(el)
    else if (ref) ref.current = el
  }

  // 손이 여닫은 뒤: 움직임이 끝나면 보이는 곳으로 데려와요
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    const el = node.current
    if (!el || !live) return
    const t = window.setTimeout(() => {
      const opener = Array.from(document.querySelectorAll('[aria-controls]')).find((b) => b.getAttribute('aria-controls') === el.id) ?? el
      const v = view(el)
      if (open) { const r = el.getBoundingClientRect(); if (r.bottom > v.bottom || r.top < v.top) show(r.height > v.bottom - v.top ? opener : el) }
      else { const r = opener.getBoundingClientRect(); if (r.top < v.top || r.bottom > v.bottom) show(opener) }
    }, still() ? 0 : 320)
    return () => window.clearTimeout(t)
  }, [open, live])

  // 앞부분만 보이는 곳: 내용이 그보다 긴지 재요
  useEffect(() => {
    const b = body.current
    if (!b || !peek) return
    const measure = () => {
      if (node.current?.classList.contains('mw-expand--open')) return
      // 다 보이면 키트의 CSS가 최소 높이를 0으로 풀어요. 그 값으로 다시 재면 "안 보임"이 되어 끝없이 뒤집히니, 접힌 채로 잰 값을 써요
      if (!node.current?.classList.contains('mw-expand--fits')) floor.current = parseFloat(getComputedStyle(b).minHeight) || 0
      const now = b.scrollHeight <= floor.current + 8
      if (now === last.current) return
      last.current = now
      setFits(now)
      told.current?.(now)
    }
    measure()
    if (typeof ResizeObserver !== 'function') return
    const watch = new ResizeObserver(measure)
    watch.observe(b)
    Array.from(b.children).forEach((child) => watch.observe(child))
    return () => watch.disconnect()
  }, [peek, children])

  // 키보드가 가려진 부분으로 들어갔어요: 펼쳐요. 브라우저가 잘린 내용을 밀어 올렸으면 제자리에 돌려놔요
  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const b = body.current
    if (!b || !peek || open || fits) return
    const under = e.target.getBoundingClientRect().bottom - b.getBoundingClientRect().top + b.scrollTop > b.clientHeight
    if (under || b.scrollTop > 0) { onReveal?.(); b.scrollTop = 0; requestAnimationFrame(() => { b.scrollTop = 0 }) }
  }

  const lines = typeof peek === 'number' ? ({ '--mw-expand-lines': peek } as CSSProperties) : undefined
  return (
    <div
      ref={setRef}
      className={cx('mw-expand', open && 'mw-expand--open', live && 'mw-expand--live', !!peek && 'mw-expand--peek', !!peek && fits && 'mw-expand--fits', flush && 'mw-expand--flush', className)}
      style={lines ? { ...lines, ...style } : style}
      {...props}
    >
      <div ref={body} className="mw-expand__body" onFocus={onFocus}>{children}</div>
    </div>
  )
}

/** 여는 버튼 안의 아래 꺾쇠예요. 버튼이 `aria-expanded="true"`가 되면 위를 향해요. 직접 만든 여는 버튼에 넣어요. */
export function ExpandChevron({ size = 16, className, ...props }: IconProps) {
  return <IcLineChevronDown size={size} className={cx('mw-expand__chevron', className)} {...props} />
}

export type ExpandButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  /** 접혀 있을 때의 말이에요. 무엇이 더 있는지 써요: `더 보기`, `4곳 더 보기`, `백업 자세히`. */
  more: ReactNode
  /** 펼쳐 있을 때의 말이에요. 기본은 `접기`예요. */
  less?: ReactNode
  /** 접혀 있는 것의 개수예요. 접혀 있을 때 말 뒤에 옅게 붙어요. */
  count?: number
  /** 줄 전체를 차지하고 가운데에 놓여요. 목록 아래의 `더 보기`에 써요. */
  block?: boolean
  /** button 요소를 가리키는 ref예요. */
  ref?: Ref<HTMLButtonElement>
}

/** 글자와 꺾쇠로 된 여는 버튼이에요. `useExpand`의 `button`을 펼쳐 넣어요. 넓은 화면에서는 보이지 않아요. */
export function ExpandButton({ more, less = '접기', count, block = false, className, ref, ...props }: ExpandButtonProps) {
  const open = props['aria-expanded'] === true || props['aria-expanded'] === 'true'
  return (
    <button ref={ref} type="button" className={cx('mw-expand-button', block && 'mw-expand-button--block', className)} {...props}>
      <span>{open ? less : more}</span>
      {!open && count !== undefined && <span className="mw-expand-button__count">{count.toLocaleString('ko-KR')}</span>}
      <ExpandChevron />
    </button>
  )
}
