/* Moonwave UX — 손짓: 시트 끌기(높이 단계 · 닫기), 당겨서 새로 고침, 길게 누르기, 밀어서 행동, 두 번 탭,
   두 손가락 모으기, 탭 줄 밀기, 끌어서 순서 바꾸기
   React 없이 DOM에 바로 붙어요. React에서는 Sheet · PullRefresh · SwipeItem · SortableList …가 이것을 써요.
   손짓마다 설정의 손짓 단계(gesture-settings.ts)를 따라요. 꺼진 손짓은 시작하지 않아요.
   규격: https://ux.moonwave.kr/patterns/touch-gestures */
import { DOUBLE_TAP_MS, EDGE_PX, FULL_SWIPE, gestureOn, PRESS_SLOP, pressMs, reducedMotion, SWIPE_SPEED, swipeDistance } from './gesture-settings'
import { haptics } from './haptics'

/** 손짓을 시작하지 않는 곳이에요. 스스로 끌리는 것(지도, 캔버스, 슬라이더)과 글자를 받는 칸이에요. */
const OWN_DRAG = 'canvas, .leaflet-container, input, textarea, select, [contenteditable], [role="slider"], [data-gesture="off"]'

/** 손을 뗄 때의 빠르기(px/ms)를 최근 100ms의 움직임으로 어림해요. */
function speedometer() {
  let samples: { t: number; y: number }[] = []
  return {
    reset() { samples = [] },
    add(y: number) {
      const t = performance.now()
      samples.push({ t, y })
      while (samples.length > 2 && t - samples[0].t > 100) samples.shift()
    },
    get() {
      if (samples.length < 2) return 0
      const a = samples[0], b = samples[samples.length - 1]
      return (b.y - a.y) / Math.max(1, b.t - a.t)
    },
  }
}

/** 화면 양옆의 뒤로 가기 자리에서 시작했는지예요. */
const atEdge = (x: number) => x < EDGE_PX || x > innerWidth - EDGE_PX

/**
 * 손짓이 무언가를 연 뒤, 손가락을 뗄 때 오는 클릭 한 번을 문서 어디에서든 먹어요(0.8초 안).
 * 손가락으로 오래 누른 뒤의 클릭은 뗀 자리에서 일어나서, 막 열린 메뉴의 가림막을 눌러 닫아 버리기 때문이에요.
 */
function eatNextClick() {
  const eat = (event: MouseEvent) => { event.preventDefault(); event.stopImmediatePropagation() }
  document.addEventListener('click', eat, { capture: true, once: true })
  setTimeout(() => document.removeEventListener('click', eat, { capture: true }), 800)
}

export interface SheetDragOptions {
  /** 손을 뗐을 때 닫기로 정해지면 불러요. */
  onClose: () => void
  /** 시트 안에서 스크롤되는 부분이에요. 그 부분이 맨 위에 있을 때만 내용을 잡고 끌 수 있어요. */
  scrolls?: string
  /** 지금 끌 수 있는지 답해요. 패널은 시트일 때(600px 이하)만 끌려요. */
  when?: () => boolean
  /**
   * 높이 단계예요. 화면 높이에 대한 비율을 작은 것부터 적어요(`SHEET_DETENTS`: 0.3 · 0.6 · 1).
   * 주면 위아래로 끌어 단계를 옮기고, 가장 낮은 단계에서 더 내리면 닫혀요. 없으면 한 단계예요(끌면 닫혀요).
   */
  detents?: readonly number[]
  /** 지금 단계의 차례예요. */
  detent?: () => number
  /** 손을 뗀 자리에 맞는 단계로 옮겼을 때 불러요. */
  onDetent?: (index: number) => void
}

/** 높이 단계예요: 낮게 30% · 중간 60% · 전체. 뒤 화면을 보며 쓰는 시트는 낮게, 고르는 시트는 중간, 상세는 전체로 열어요. */
export const SHEET_DETENTS: readonly number[] = [0.3, 0.6, 1]

/** 단계가 있는 시트가 단계 i에 있을 때 아래로 내려가 있는 거리(px)예요. */
export function sheetOffset(node: HTMLElement, detents: readonly number[], i: number): number {
  const d = detents[Math.max(0, Math.min(detents.length - 1, i))]
  return Math.max(0, Math.round(node.offsetHeight - d * innerHeight))
}

/**
 * 아래에서 올라온 시트(`mw-sheet`, 600px 이하의 `mw-app-panel`)를 끌어 닫거나 높이 단계를 옮기게 해요.
 * 손잡이와 머리에서는 언제나, 내용에서는 맨 위까지 올라와 있을 때 끌려요. 높이의 3분의 1을 넘기거나 빠르게 내리면 닫혀요.
 * 단계가 있으면 손을 뗀 빠르기까지 셈해 가까운 단계에 멈추고, 가장 낮은 단계 아래로 내리면 닫혀요.
 * 닫힐 때의 움직임은 시트의 CSS 전환이 맡아요. 돌려주는 함수를 부르면 떼어 내요.
 */
export function sheetDrag(node: HTMLElement, { onClose, scrolls = '.mw-sheet__body, .mw-app-panel__body', when, detents, detent, onDetent }: SheetDragOptions): () => void {
  let mode: 'idle' | 'pending' | 'drag' | 'off' = 'idle'
  let y0 = 0, dy = 0, base = 0, scroller: HTMLElement | null = null
  const speed = speedometer()
  const now = () => (detents ? Math.max(0, Math.min(detents.length - 1, detent?.() ?? detents.length - 1)) : 0)

  const start = (event: TouchEvent) => {
    const from = event.target as Element | null
    if (!gestureOn('sheet') || event.touches.length !== 1 || !from || (when && !when()) || from.closest(OWN_DRAG)) { mode = 'off'; return }
    const inside = from.closest<HTMLElement>(scrolls)
    scroller = inside && node.contains(inside) ? inside : null
    y0 = event.touches[0].clientY
    dy = 0
    base = detents ? sheetOffset(node, detents, now()) : 0
    mode = 'pending'
    speed.reset()
    speed.add(y0)
  }
  const move = (event: TouchEvent) => {
    if (mode !== 'pending' && mode !== 'drag') return
    const y = event.touches[0].clientY
    dy = y - y0
    speed.add(y)
    if (mode === 'pending') {
      if (Math.abs(dy) < 6) return
      // 위로 미는 것은 시트가 더 커질 수 있을 때만 끌기예요. 내용이 아직 위로 더 남아 있으면 스크롤이에요
      const grow = !!detents && now() < detents.length - 1
      if ((dy < 0 && !grow) || (scroller && scroller.scrollTop > 0)) { mode = 'off'; return }
      mode = 'drag'
      node.style.transition = 'none'
    }
    event.preventDefault()
    node.style.transform = `translate3d(0, ${Math.max(0, base + dy)}px, 0)`
  }
  const close = () => {
    // 닫힌 자리까지는 이 값으로 가고, 닫힌 뒤에는 아래의 정리에서 시트의 제 스타일로 돌아가요
    node.style.transform = 'translate3d(0, 105%, 0)'
    haptics.tap()
    onClose()
  }
  const end = () => {
    const was = mode
    mode = 'idle'
    if (was !== 'drag') return
    node.style.transition = ''
    if (!detents) {
      if (dy > node.getBoundingClientRect().height / 3 || speed.get() > 0.6) close()
      else node.style.transform = ''
      return
    }
    // 손을 뗀 빠르기만큼 조금 더 간 자리에서 가장 가까운 단계로 가요
    const ahead = Math.max(0, base + dy) + speed.get() * 180
    const offsets = detents.map((_, i) => sheetOffset(node, detents, i))
    const shown = node.offsetHeight - offsets[0]
    if (ahead > offsets[0] + shown * 0.4) { close(); return }
    let best = 0
    offsets.forEach((o, i) => { if (Math.abs(o - ahead) < Math.abs(offsets[best] - ahead)) best = i })
    node.style.setProperty('--mw-sheet-y', `${offsets[best]}px`)
    node.style.transform = ''
    if (best !== now()) haptics.select()
    onDetent?.(best)
  }

  node.addEventListener('touchstart', start, { passive: true })
  node.addEventListener('touchmove', move, { passive: false })
  node.addEventListener('touchend', end)
  node.addEventListener('touchcancel', end)
  return () => {
    node.removeEventListener('touchstart', start)
    node.removeEventListener('touchmove', move)
    node.removeEventListener('touchend', end)
    node.removeEventListener('touchcancel', end)
    node.style.transition = ''
    node.style.transform = ''
  }
}

const ARM = 64   // 이만큼 당기면 새로 고침이 걸려요
const REST = 52  // 새로 고치는 동안 내용이 머무는 자리
const FAR = 150  // 아무리 당겨도 넘지 않는 거리

export interface PullRefreshOptions {
  /** 당겼다 놓으면 불러요. 약속(Promise)을 돌려주면 끝날 때까지 동그라미가 돌아요. */
  onRefresh: () => void | Promise<unknown>
  /** 내려오는 동그라미(`mw-pull`)예요. */
  indicator?: HTMLElement | null
}

/**
 * 세로로 스크롤되는 내용(`mw-app-content`)이 맨 위에 있을 때 아래로 당기면 새로 고쳐요.
 * 내용이 손가락을 따라 내려오고, 64px을 넘기면 걸려요(진동). 놓으면 `onRefresh`를 부르고 끝날 때까지 기다려요.
 * 돌려주는 함수를 부르면 떼어 내요.
 */
export function pullRefresh(scroller: HTMLElement, { onRefresh, indicator }: PullRefreshOptions): () => void {
  let mode: 'idle' | 'pending' | 'pull' | 'off' = 'idle'
  let x0 = 0, y0 = 0, pulled = 0, armed = false, busy = false

  const paint = (v: number, glide = false) => {
    pulled = v
    scroller.style.transition = glide ? 'transform var(--motion-duration-long) var(--mw-ease)' : 'none'
    scroller.style.transform = v > 0.25 ? `translate3d(0, ${v}px, 0)` : ''
    if (!indicator) return
    // 당기지 않을 때는 그리지 않아요(키트의 mw-pull은 숨겨져 있어요)
    if (v > 0.25) indicator.style.visibility = 'visible'
    indicator.style.transition = glide ? 'transform var(--motion-duration-long) var(--mw-ease), opacity var(--motion-duration-long) var(--mw-ease)' : 'none'
    indicator.style.transform = `translate3d(0, ${Math.max(-44, v / 2 - 20)}px, 0)`
    indicator.style.opacity = String(Math.min(1, v / 36))
    indicator.style.setProperty('--mw-pull', String(Math.min(1, v / ARM)))
  }
  const settle = () => {
    paint(0, true)
    const done = () => { scroller.style.transition = ''; if (indicator && pulled <= 0.25) indicator.style.visibility = ''; scroller.removeEventListener('transitionend', done) }
    scroller.addEventListener('transitionend', done)
  }

  const start = (event: TouchEvent) => {
    const from = event.target as Element | null
    if (busy || !gestureOn('pull') || event.touches.length !== 1 || !from || from.closest(OWN_DRAG)) { mode = 'off'; return }
    // 안쪽에서 따로 스크롤되는 것이 아직 위로 남아 있으면 그것의 스크롤이에요
    for (let n: Element | null = from; n && n !== scroller; n = n.parentElement) if (n.scrollTop > 0) { mode = 'off'; return }
    x0 = event.touches[0].clientX
    y0 = event.touches[0].clientY
    mode = 'pending'
  }
  const move = (event: TouchEvent) => {
    if (mode !== 'pending' && mode !== 'pull') return
    const dx = event.touches[0].clientX - x0, dy = event.touches[0].clientY - y0
    if (mode === 'pending') {
      if (Math.hypot(dx, dy) < 4) return
      if (scroller.scrollTop > 0 || dy <= 0 || dy < Math.abs(dx)) { mode = 'off'; return }
      mode = 'pull'
    }
    event.preventDefault()
    const d = Math.max(0, dy)
    paint((FAR * d) / (d + FAR))
    if (pulled >= ARM && !armed) { armed = true; haptics.impact() } else if (pulled < ARM - 8 && armed) armed = false
  }
  const end = () => {
    const was = mode
    mode = 'idle'
    if (was !== 'pull') return
    if (!armed) { settle(); return }
    armed = false
    busy = true
    indicator?.classList.add('mw-pull--busy')
    paint(REST, true)
    const started = performance.now()
    Promise.resolve()
      .then(onRefresh)
      .catch(() => { /* 실패를 알리는 것은 부른 쪽의 일이에요 */ })
      // 너무 빨리 끝나도 돌았다는 것이 보이게 650ms는 머물러요
      .then(() => new Promise((ok) => setTimeout(ok, Math.max(0, 650 - (performance.now() - started)))))
      .then(() => {
        haptics.success()
        indicator?.classList.remove('mw-pull--busy')
        busy = false
        settle()
      })
  }

  scroller.addEventListener('touchstart', start, { passive: true })
  scroller.addEventListener('touchmove', move, { passive: false })
  scroller.addEventListener('touchend', end)
  scroller.addEventListener('touchcancel', end)
  return () => {
    scroller.removeEventListener('touchstart', start)
    scroller.removeEventListener('touchmove', move)
    scroller.removeEventListener('touchend', end)
    scroller.removeEventListener('touchcancel', end)
    scroller.style.transition = ''
    scroller.style.transform = ''
    if (indicator) indicator.style.visibility = ''
  }
}

// ── 길게 누르기

export type PressAt = { x: number; y: number; target: Element }

export interface LongPressOptions {
  /** 받아들여졌을 때 불러요. 손가락은 아직 화면에 있어요. 이때 한 번 떨어요. */
  onPress: (at: PressAt) => void
  /** 누르기를 시작하지 않는 곳이에요. 기본은 스스로 끌리는 것과 글자를 받는 칸이에요. */
  ignore?: string
}

/**
 * 손가락으로 누른 채 설정의 시간(짧게 350 · 보통 500 · 길게 700ms)을 기다리면 `onPress`를 불러요.
 * 그 사이에 8px 넘게 움직이거나, 두 번째 손가락이 닿거나, 스크롤이 시작되면 취소해요. 마우스는 받지 않아요(오른쪽 클릭이 그 길이에요).
 * 받아들여진 뒤의 탭과 기기의 메뉴(텍스트 선택, 링크 메뉴)는 막아요. 돌려주는 함수를 부르면 떼어 내요.
 */
export function longPress(node: HTMLElement, { onPress, ignore = OWN_DRAG }: LongPressOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let id = -1, x0 = 0, y0 = 0, fired = 0
  node.setAttribute('data-mw-press', '')
  const cancel = () => { clearTimeout(timer); timer = undefined; id = -1 }
  const down = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return
    if (!event.isPrimary) { cancel(); return }
    const from = event.target as Element | null
    if (!from || from.closest(ignore) || atEdge(event.clientX)) return
    id = event.pointerId
    x0 = event.clientX
    y0 = event.clientY
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      fired = performance.now()
      haptics.impact()
      eatNextClick()
      onPress({ x: x0, y: y0, target: from })
    }, pressMs())
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId === id && timer && Math.hypot(event.clientX - x0, event.clientY - y0) > PRESS_SLOP) cancel()
  }
  const up = (event: PointerEvent) => { if (event.pointerId === id) cancel() }
  const click = (event: MouseEvent) => {
    if (performance.now() - fired < 800) { event.preventDefault(); event.stopImmediatePropagation(); fired = 0 }
  }
  const menu = (event: MouseEvent) => { if (timer || performance.now() - fired < 1000) event.preventDefault() }
  node.addEventListener('pointerdown', down, { passive: true })
  node.addEventListener('pointermove', move, { passive: true })
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', cancel)
  node.addEventListener('click', click, true)
  node.addEventListener('contextmenu', menu)
  return () => {
    cancel()
    node.removeAttribute('data-mw-press')
    node.removeEventListener('pointerdown', down)
    node.removeEventListener('pointermove', move)
    node.removeEventListener('pointerup', up)
    node.removeEventListener('pointercancel', cancel)
    node.removeEventListener('click', click, true)
    node.removeEventListener('contextmenu', menu)
  }
}

// ── 밀어서 행동

export type SwipeSide = 'left' | 'right'
export type SwipeRest = 'closed' | SwipeSide

export interface SwipeRowOptions {
  /** 그쪽으로 밀면 드러나는 행동 줄의 너비(px)예요. `left`는 왼쪽으로 밀 때(오른쪽 끝의 줄)예요. 0이면 그쪽으로 밀리지 않아요. */
  tray: (side: SwipeSide) => number
  /** 끝까지 밀어 바로 하기가 켜져 있는지예요. */
  full: () => boolean
  /** 손을 뗐을 때 정해진 곳이에요. `{ full }`이면 그쪽의 첫 행동을 바로 해요. */
  onSettle: (to: SwipeRest | { full: SwipeSide }) => void
  /** 끌기를 시작했을 때 불러요. 다른 열린 줄을 닫을 때 써요. */
  onStart?: () => void
  /** 끝까지 민 자리를 넘나들 때 불러요. 넘을 때 한 번 떨어요. */
  onArm?: (side: SwipeSide | null) => void
}

export type SwipeRowControl = {
  /** 지금 열린 쪽이에요. */
  rest: () => SwipeRest
  /** 그 자리로 옮겨요. 움직임을 줄이는 사람에게는 바로 가요. */
  set: (to: SwipeRest) => void
  /** 끝까지 민 쪽으로 밀어 내보내요(지우기 · 보관처럼 목록에서 빠지는 행동). */
  out: (side: SwipeSide) => void
  destroy: () => void
}

/**
 * 목록의 한 줄(`mw-swipe__body`)을 손가락으로 옆으로 밀게 해요. 세로로 먼저 움직이면 스크롤에 넘겨요(방향 잠금, `touch-action: pan-y`).
 * 설정의 거리(낮음 140 · 보통 100 · 높음 70px)를 넘기거나 500px/s보다 빠르게 놓으면 그쪽 행동 줄이 열리고, 못 미치면 튕기며 돌아가요.
 * 끝까지 밀어 바로 하기가 켜져 있으면 줄 너비의 60%를 넘겨 놓을 때 `{ full }`을 알려요. 화면 양옆 20px에서 시작한 손짓은 받지 않아요.
 * 줄의 부모에 `--mw-swipe-p`(0~1, 드러난 정도)를 적어요. 키트의 CSS가 행동 버튼을 그만큼 키워요.
 */
export function swipeRow(node: HTMLElement, { tray, full, onSettle, onStart, onArm }: SwipeRowOptions): SwipeRowControl {
  let mode: 'idle' | 'pending' | 'drag' | 'off' = 'idle'
  let id = -1, x0 = 0, y0 = 0, base = 0, x = 0, travel = 0, rest: SwipeRest = 'closed', armed: SwipeSide | null = null, dragged = false
  const speed = speedometer()
  const box = node.parentElement
  const restX = (to: SwipeRest) => (to === 'left' ? -tray('left') : to === 'right' ? tray('right') : 0)
  const paint = (v: number, glide: string | null) => {
    x = v
    node.style.transition = glide && !reducedMotion() ? glide : 'none'
    node.style.transform = v ? `translate3d(${v}px, 0, 0)` : ''
    const side: SwipeSide = v < 0 ? 'left' : 'right'
    const w = tray(side)
    box?.style.setProperty('--mw-swipe-p', w ? String(Math.min(1, Math.abs(v) / w)) : '0')
    box?.setAttribute('data-swipe-side', v ? side : '')
  }
  const set = (to: SwipeRest) => {
    rest = to
    paint(restX(to), 'transform var(--motion-duration-long) var(--mw-ease-pop)')
  }
  const out = (side: SwipeSide) => {
    paint(side === 'left' ? -node.offsetWidth : node.offsetWidth, 'transform var(--motion-duration-medium) var(--motion-easing-ease-in)')
  }

  const down = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return
    if (!event.isPrimary) { if (mode === 'drag') settle(true); mode = 'off'; return }
    dragged = false
    const from = event.target as Element | null
    if (!from || from.closest(OWN_DRAG) || from.closest('.mw-sortable__item--lifted') || atEdge(event.clientX)) { mode = 'off'; return }
    id = event.pointerId
    x0 = event.clientX
    y0 = event.clientY
    base = restX(rest)
    travel = 0
    mode = 'pending'
    speed.reset()
    speed.add(x0)
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId !== id || (mode !== 'pending' && mode !== 'drag')) return
    const dx = event.clientX - x0, dy = event.clientY - y0
    travel = dx
    speed.add(event.clientX)
    if (mode === 'pending') {
      if (Math.hypot(dx, dy) < PRESS_SLOP) return
      // 세로가 먼저면 스크롤이에요
      if (Math.abs(dy) > Math.abs(dx) || node.closest('.mw-sortable__item--lifted')) { mode = 'off'; return }
      mode = 'drag'
      dragged = true
      try { node.setPointerCapture(id) } catch { /* 이미 떠난 손가락이에요 */ }
      box?.classList.add('mw-swipe--moving')
      onStart?.()
    }
    let v = base + dx
    const side: SwipeSide = v < 0 ? 'left' : 'right'
    const w = tray(side), far = node.offsetWidth
    // 행동이 없는 쪽은 살짝만 따라오고, 행동 줄을 넘어서는 끝까지 밀기가 켜져 있을 때만 손가락을 다 따라와요
    if (!w) v = Math.sign(v) * Math.min(Math.abs(v) * 0.15, 16)
    else if (Math.abs(v) > w && !full()) v = Math.sign(v) * (w + (Math.abs(v) - w) * 0.25)
    else v = Math.sign(v) * Math.min(Math.abs(v), far)
    const arm: SwipeSide | null = w && full() && Math.abs(v) >= far * FULL_SWIPE ? side : null
    if (arm !== armed) { armed = arm; if (arm) haptics.impact(); onArm?.(arm) }
    paint(v, null)
  }
  const settle = (cancelled = false) => {
    const was = mode
    mode = 'idle'
    id = -1
    box?.classList.remove('mw-swipe--moving')
    if (was !== 'drag') return
    const v = speed.get(), dist = swipeDistance()
    const hit = armed
    armed = null
    onArm?.(null)
    if (hit && !cancelled) { onSettle({ full: hit }); return }
    // 거리는 손가락이 실제로 간 만큼으로 재요(줄은 행동 줄을 넘으면 덜 따라오지만, 걸리는 것은 손가락의 거리예요)
    let to: SwipeRest = rest
    if (cancelled) to = rest
    else if (rest === 'closed') {
      if ((travel <= -dist || v <= -SWIPE_SPEED) && travel < 0 && tray('left')) to = 'left'
      else if ((travel >= dist || v >= SWIPE_SPEED) && travel > 0 && tray('right')) to = 'right'
    } else {
      // 열린 줄은 조금만 되밀어도 닫혀요
      const back = rest === 'left' ? travel : -travel
      const fling = rest === 'left' ? v >= SWIPE_SPEED : v <= -SWIPE_SPEED
      if (back > dist / 2 || fling || Math.sign(x) !== (rest === 'left' ? -1 : 1)) to = 'closed'
    }
    set(to)
    onSettle(to)
  }
  const up = (event: PointerEvent) => { if (event.pointerId === id) settle() }
  const cancel = (event: PointerEvent) => { if (event.pointerId === id) settle(true) }
  // 민 뒤의 탭은 먹고, 열린 줄을 누르면 닫기만 해요
  const click = (event: MouseEvent) => {
    if (dragged) { dragged = false; event.preventDefault(); event.stopImmediatePropagation(); return }
    if (rest !== 'closed') { event.preventDefault(); event.stopImmediatePropagation(); set('closed'); onSettle('closed') }
  }
  node.addEventListener('pointerdown', down, { passive: true })
  node.addEventListener('pointermove', move, { passive: true })
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', cancel)
  node.addEventListener('click', click, true)
  return {
    rest: () => rest,
    set,
    out,
    destroy: () => {
      node.removeEventListener('pointerdown', down)
      node.removeEventListener('pointermove', move)
      node.removeEventListener('pointerup', up)
      node.removeEventListener('pointercancel', cancel)
      node.removeEventListener('click', click, true)
      node.style.transition = ''
      node.style.transform = ''
      box?.style.removeProperty('--mw-swipe-p')
      box?.removeAttribute('data-swipe-side')
      box?.classList.remove('mw-swipe--moving')
    },
  }
}

// ── 두 번 탭

export interface DoubleTapOptions {
  /** 두 번 탭했을 때 불러요. 탭한 자리(화면 좌표)를 넘겨요. */
  onDouble: (at: { x: number; y: number }) => void
  /** 두 번 탭을 보지 않는 곳이에요. 기본은 안쪽의 버튼과 입력 칸이에요(하트 버튼, ⋯ 버튼). */
  ignore?: string
}

/**
 * 손가락으로 빠르게 두 번 탭하면 `onDouble`을 불러요. 첫 탭이 원래 하던 일(링크 열기, 상세 열기)은 두 번째 탭을 기다린 뒤(280ms) 해요.
 * 마우스 클릭은 기다리지 않아요. 브라우저의 두 번 탭 확대는 `touch-action: manipulation`으로 꺼요(키트의 CSS).
 */
export function doubleTap(node: HTMLElement, { onDouble, ignore = 'button, [role="button"], input, select, textarea, label, [data-gesture="off"]' }: DoubleTapOptions): () => void {
  let touch = false, replay = false
  let pending: ReturnType<typeof setTimeout> | undefined
  let last = { t: 0, x: 0, y: 0 }
  node.setAttribute('data-mw-double', '')
  const down = (event: PointerEvent) => { touch = event.pointerType !== 'mouse' }
  const click = (event: MouseEvent) => {
    if (replay || !touch) return
    const from = event.target as HTMLElement | null
    if (!from) return
    const control = from.closest(ignore)
    if (control && control !== node && node.contains(control)) return
    const now = performance.now()
    if (pending !== undefined && now - last.t < DOUBLE_TAP_MS && Math.hypot(event.clientX - last.x, event.clientY - last.y) < 32) {
      clearTimeout(pending)
      pending = undefined
      event.preventDefault()
      event.stopImmediatePropagation()
      onDouble({ x: event.clientX, y: event.clientY })
      return
    }
    // 첫 탭: 두 번째 탭을 잠깐 기다렸다가 원래 하던 일을 해요
    event.preventDefault()
    event.stopImmediatePropagation()
    last = { t: now, x: event.clientX, y: event.clientY }
    clearTimeout(pending)
    pending = setTimeout(() => {
      pending = undefined
      replay = true
      try { from.click() } finally { replay = false }
    }, DOUBLE_TAP_MS)
  }
  node.addEventListener('pointerdown', down, { passive: true })
  node.addEventListener('click', click, true)
  return () => {
    clearTimeout(pending)
    node.removeAttribute('data-mw-double')
    node.removeEventListener('pointerdown', down)
    node.removeEventListener('click', click, true)
  }
}

// ── 두 손가락 모으기 · 벌리기

export interface PinchStepOptions {
  /** 모았으면 `in`(더 촘촘히), 벌렸으면 `out`(더 크게)이에요. 손짓 한 번에 한 번만 불러요. */
  onPinch: (direction: 'in' | 'out') => void
  /** 처음 거리의 몇 배가 되면 걸리는지예요. 기본 1.25배(모으면 0.8배)예요. */
  ratio?: number
}

/**
 * 두 손가락을 모으거나 벌리면 한 단계를 알려요. 그동안 브라우저의 확대는 이 영역에서만 쉬어요.
 * 한 손가락의 스크롤은 그대로예요. 돌려주는 함수를 부르면 떼어 내요.
 */
export function pinchSteps(node: HTMLElement, { onPinch, ratio = 1.25 }: PinchStepOptions): () => void {
  let d0 = 0, done = false
  const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  const start = (event: TouchEvent) => { if (event.touches.length === 2) { d0 = dist(event.touches); done = false } }
  const move = (event: TouchEvent) => {
    if (event.touches.length !== 2 || !d0) return
    if (event.cancelable) event.preventDefault()
    if (done) return
    const r = dist(event.touches) / d0
    if (r <= 1 / ratio) { done = true; onPinch('in') } else if (r >= ratio) { done = true; onPinch('out') }
  }
  const end = (event: TouchEvent) => { if (event.touches.length < 2) d0 = 0 }
  node.addEventListener('touchstart', start, { passive: true })
  node.addEventListener('touchmove', move, { passive: false })
  node.addEventListener('touchend', end)
  node.addEventListener('touchcancel', end)
  return () => {
    node.removeEventListener('touchstart', start)
    node.removeEventListener('touchmove', move)
    node.removeEventListener('touchend', end)
    node.removeEventListener('touchcancel', end)
  }
}

// ── 탭 줄 밀기

/**
 * 하단 탭 줄(`mw-app-tabbar`)이나 고정 탭(`mw-tab-group--fixed`)을 옆으로 밀면 옆 탭으로 가요. 왼쪽으로 밀면 다음(+1), 오른쪽은 이전(-1)이에요.
 * 거리는 밀기와 같은 설정을 따르고, 화면 양옆 20px에서 시작한 손짓은 받지 않아요.
 */
export function tabSwipe(node: HTMLElement, { onSwipe }: { onSwipe: (step: 1 | -1) => void }): () => void {
  let id = -1, x0 = 0, y0 = 0, sideways = false, used = false
  const speed = speedometer()
  node.setAttribute('data-mw-tabswipe', '')
  const down = (event: PointerEvent) => {
    used = false
    if (event.pointerType === 'mouse' || !event.isPrimary || atEdge(event.clientX)) { id = -1; return }
    id = event.pointerId
    x0 = event.clientX
    y0 = event.clientY
    sideways = false
    speed.reset()
    speed.add(x0)
  }
  const move = (event: PointerEvent) => {
    if (event.pointerId !== id) return
    speed.add(event.clientX)
    const dx = event.clientX - x0, dy = event.clientY - y0
    if (!sideways && Math.abs(dx) > PRESS_SLOP && Math.abs(dx) > Math.abs(dy)) sideways = true
  }
  const up = (event: PointerEvent) => {
    if (event.pointerId !== id) return
    id = -1
    const dx = event.clientX - x0, v = speed.get()
    if (!sideways) return
    if (dx <= -swipeDistance() || v <= -SWIPE_SPEED) { used = true; onSwipe(1) } else if (dx >= swipeDistance() || v >= SWIPE_SPEED) { used = true; onSwipe(-1) }
  }
  // 민 뒤에 손가락 아래의 탭이 눌리지 않게 해요
  const click = (event: MouseEvent) => { if (used) { used = false; event.preventDefault(); event.stopImmediatePropagation() } }
  const cancel = () => { id = -1 }
  node.addEventListener('pointerdown', down, { passive: true })
  node.addEventListener('pointermove', move, { passive: true })
  node.addEventListener('pointerup', up)
  node.addEventListener('pointercancel', cancel)
  node.addEventListener('click', click, true)
  return () => {
    node.removeAttribute('data-mw-tabswipe')
    node.removeEventListener('pointerdown', down)
    node.removeEventListener('pointermove', move)
    node.removeEventListener('pointerup', up)
    node.removeEventListener('pointercancel', cancel)
    node.removeEventListener('click', click, true)
  }
}

// ── 끌어서 순서 바꾸기

export interface ReorderOptions {
  /** 옮길 수 있는 줄이에요. 목록의 바로 아래 요소 가운데 이 선택자에 맞는 것이에요. */
  items?: string
  /** 들어 올렸을 때 불러요(0부터의 차례). */
  onLift?: (index: number) => void
  /** 다른 자리에 놓았을 때 불러요. 이 안에서 화면의 순서를 바로 바꿔요(React는 flushSync). */
  onMove: (from: number, to: number) => void
  /** 들어 올린 뒤 움직이지 않고 놓았을 때 불러요. 그 항목의 메뉴를 열어요. */
  onRelease?: (index: number, at: { x: number; y: number }) => void
  /** 놓았을 때(옮겼든 아니든) 불러요. */
  onDrop?: () => void
}

/**
 * 목록의 줄을 길게 눌러 들어 올리고(진동), 위아래로 끌어 순서를 바꾸게 해요. 끄는 동안 다른 줄이 비켜 서고,
 * 화면 위아래 끝에 닿으면 목록이 스스로 스크롤돼요. 들어 올리기 전에 움직이면 스크롤이에요. 돌려주는 함수를 부르면 떼어 내요.
 */
export function reorder(list: HTMLElement, { items = 'li', onLift, onMove, onRelease, onDrop }: ReorderOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let row: HTMLElement | null = null, lifted: HTMLElement | null = null
  let rows: HTMLElement[] = [], mids: number[] = []
  let from = -1, to = -1, step = 0, x0 = 0, y0 = 0, y = 0, scroll0 = 0, raf = 0, dropped = 0
  let scroller: HTMLElement = document.scrollingElement as HTMLElement

  const scrollParent = (el: HTMLElement): HTMLElement => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY
      if ((o === 'auto' || o === 'scroll') && n.scrollHeight > n.clientHeight) return n
    }
    return document.scrollingElement as HTMLElement
  }
  const paint = () => {
    if (!lifted) return
    const dy = y - y0 + (scroller.scrollTop - scroll0)
    lifted.style.transform = `translate3d(0, ${dy}px, 0)`
    const mid = mids[from] + dy
    let next = 0
    mids.forEach((m, i) => { if (i !== from && m < mid) next++ })
    if (next === to) return
    to = next
    haptics.select()
    rows.forEach((r, i) => {
      if (i === from) return
      const shift = from < to && i > from && i <= to ? -step : from > to && i >= to && i < from ? step : 0
      r.style.transform = shift ? `translate3d(0, ${shift}px, 0)` : ''
    })
  }
  const follow = () => {
    if (!lifted) return
    const r = scroller === document.scrollingElement ? { top: 0, bottom: innerHeight } : scroller.getBoundingClientRect()
    const edge = 64
    const pull = y < r.top + edge ? -(r.top + edge - y) : y > r.bottom - edge ? y - (r.bottom - edge) : 0
    if (pull) { scroller.scrollTop += Math.max(-14, Math.min(14, pull / 4)); paint() }
    raf = requestAnimationFrame(follow)
  }
  const lift = () => {
    timer = undefined
    if (!row) return
    rows = Array.from(list.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.matches(items))
    from = rows.indexOf(row)
    if (from < 0) return
    const rects = rows.map((r) => r.getBoundingClientRect())
    mids = rects.map((r) => r.top + r.height / 2)
    const next = rects[from + 1], prev = rects[from - 1]
    const gap = next ? next.top - rects[from].bottom : prev ? rects[from].top - prev.bottom : 0
    step = rects[from].height + Math.max(0, gap)
    scroller = scrollParent(list)
    scroll0 = scroller.scrollTop
    to = from
    lifted = row
    list.classList.add('mw-sortable--dragging')
    lifted.classList.add('mw-sortable__item--lifted')
    haptics.impact()
    onLift?.(from)
    raf = requestAnimationFrame(follow)
  }
  const drop = () => {
    cancelAnimationFrame(raf)
    rows.forEach((r) => { r.style.transition = 'none'; r.style.transform = '' })
    lifted?.classList.remove('mw-sortable__item--lifted')
    list.classList.remove('mw-sortable--dragging')
    const was = rows
    requestAnimationFrame(() => was.forEach((r) => { r.style.transition = '' }))
    lifted = null
    row = null
    dropped = performance.now()
  }
  const start = (event: TouchEvent) => {
    clearTimeout(timer)
    timer = undefined
    if (event.touches.length !== 1 || lifted) return
    const from0 = event.target as Element | null
    let hit: Element | null = from0
    while (hit && hit.parentElement !== list) hit = hit.parentElement
    if (!from0 || !(hit instanceof HTMLElement) || !hit.matches(items) || from0.closest(OWN_DRAG) || atEdge(event.touches[0].clientX)) return
    row = hit
    x0 = event.touches[0].clientX
    y0 = y = event.touches[0].clientY
    timer = setTimeout(lift, pressMs())
  }
  const move = (event: TouchEvent) => {
    const t = event.touches[0]
    if (!t) return
    if (!lifted) {
      if (timer && Math.hypot(t.clientX - x0, t.clientY - y0) > PRESS_SLOP) { clearTimeout(timer); timer = undefined }
      return
    }
    if (event.cancelable) event.preventDefault()
    y = t.clientY
    paint()
  }
  const end = (event: TouchEvent) => {
    clearTimeout(timer)
    timer = undefined
    if (!lifted) return
    const a = from, b = to, still = Math.abs(y - y0) <= PRESS_SLOP
    const at = { x: event.changedTouches[0]?.clientX ?? x0, y }
    drop()
    if (event.type === 'touchend') {
      eatNextClick()
      if (a !== b) onMove(a, b)
      else if (still) onRelease?.(a, at)
    }
    onDrop?.()
  }
  const click = (event: MouseEvent) => { if (performance.now() - dropped < 700) { event.preventDefault(); event.stopImmediatePropagation() } }
  const menu = (event: MouseEvent) => { if (timer || lifted) event.preventDefault() }
  list.setAttribute('data-mw-reorder', '')
  list.addEventListener('touchstart', start, { passive: true })
  list.addEventListener('touchmove', move, { passive: false })
  list.addEventListener('touchend', end)
  list.addEventListener('touchcancel', end)
  list.addEventListener('click', click, true)
  list.addEventListener('contextmenu', menu)
  return () => {
    clearTimeout(timer)
    if (lifted) drop()
    list.removeAttribute('data-mw-reorder')
    list.removeEventListener('touchstart', start)
    list.removeEventListener('touchmove', move)
    list.removeEventListener('touchend', end)
    list.removeEventListener('touchcancel', end)
    list.removeEventListener('click', click, true)
    list.removeEventListener('contextmenu', menu)
  }
}
