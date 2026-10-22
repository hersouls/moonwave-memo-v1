/* Moonwave UX — 화면 전환: 카드가 상세로 펼쳐지고, 보기 방식이 바뀔 때 타일이 제자리로 옮겨 가요
   브라우저의 View Transitions로 해요. 그것이 없거나, 움직임을 줄이거나, 움직임 단계가 차분히 · 가볍게면 바로 바뀌어요(같은 결과, 움직임만 없어요).
   규격: https://ux.moonwave.kr/patterns/touch-gestures#transition */
import { flushSync } from 'react-dom'
import { motionStep } from './gesture-settings'

type Transition = { finished: Promise<void> }
type WithTransition = Document & { startViewTransition?: (update: () => void) => Transition }

/** 지금 움직여 바꿀 수 있는지예요. 화면 전환은 움직임 단계가 표준 · 풍부하게일 때만이에요(차분히 · 가볍게 · 줄이기는 바로 바뀌어요). */
export function canTransition(): boolean {
  const step = motionStep()
  return typeof document !== 'undefined' && typeof (document as WithTransition).startViewTransition === 'function' && (step === 'standard' || step === 'rich')
}

/** 바꾸는 동안 `<html class="mw-vt">`를 붙여요. 키트의 CSS가 그동안 패널의 제 전환을 쉬게 해요(두 움직임이 겹치지 않게). */
function run(update: () => void, before: () => void, after: () => void): Promise<void> {
  if (!canTransition()) { update(); return Promise.resolve() }
  const root = document.documentElement
  root.classList.add('mw-vt')
  before()
  const t = (document as WithTransition).startViewTransition!(() => { flushSync(update); after() })
  return t.finished.catch(() => {}).finally(() => root.classList.remove('mw-vt'))
}

/**
 * 누른 카드에서 상세(서랍 · 전체 화면 패널)가 펼쳐져 나와요. `update`에서 상세를 열고, `target`은 열린 상세 요소를 돌려줘요.
 *
 * ```tsx
 * <article ref={card} onClick={() => expandFrom(card.current, () => setOpen(id), () => document.getElementById('trip-detail'))}>
 * ```
 */
export function expandFrom(source: HTMLElement | null, update: () => void, target: () => HTMLElement | null): Promise<void> {
  if (!source) { update(); return Promise.resolve() }
  return run(update, () => { source.style.viewTransitionName = 'mw-expand' }, () => {
    source.style.viewTransitionName = ''
    const el = target()
    if (el) el.style.viewTransitionName = 'mw-expand'
  }).finally(() => { const el = target(); if (el) el.style.viewTransitionName = '' })
}

/** 상세가 다시 그 카드로 접혀 들어가요. `expandFrom`의 반대예요. */
export function collapseTo(target: HTMLElement | null, update: () => void, source: () => HTMLElement | null): Promise<void> {
  const from = source()
  if (!from) { update(); return Promise.resolve() }
  return run(update, () => { from.style.viewTransitionName = 'mw-expand' }, () => {
    from.style.viewTransitionName = ''
    if (target) target.style.viewTransitionName = 'mw-expand'
  }).finally(() => { if (target) target.style.viewTransitionName = '' })
}

/**
 * 목록의 짜임이 바뀔 때(카드 ↔ 그리드) 화면에 보이는 타일이 새 자리로 옮겨 가요. 보이는 타일에만 이름을 붙여 가볍게 해요.
 * `tiles`는 타일을 고르는 선택자예요(기본 `.mw-item-tile`).
 */
export function layoutTransition(container: HTMLElement | null, update: () => void, tiles = '.mw-item-tile'): Promise<void> {
  if (!container) { update(); return Promise.resolve() }
  let named: HTMLElement[] = []
  const name = () => {
    named = Array.from(container.querySelectorAll<HTMLElement>(tiles)).filter((el) => {
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < innerHeight
    }).slice(0, 80)
    named.forEach((el, i) => { el.style.viewTransitionName = `mw-tile-${i}` })
  }
  return run(update, name, () => {}).finally(() => named.forEach((el) => { el.style.viewTransitionName = '' }))
}
