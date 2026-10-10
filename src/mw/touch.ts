/* Moonwave UX — 손짓: 시트를 끌어 닫기, 당겨서 새로 고침
   React 없이 DOM에 바로 붙어요. React에서는 Sheet와 PullRefresh가 이것을 써요.
   규격: https://ux.moonwave.kr/patterns/app-shell#keys */
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

export interface SheetDragOptions {
  /** 손을 뗐을 때 닫기로 정해지면 불러요. */
  onClose: () => void
  /** 시트 안에서 스크롤되는 부분이에요. 그 부분이 맨 위에 있을 때만 내용을 잡고 끌 수 있어요. */
  scrolls?: string
  /** 지금 끌 수 있는지 답해요. 패널은 시트일 때(600px 이하)만 끌려요. */
  when?: () => boolean
}

/**
 * 아래에서 올라온 시트(`mw-sheet`, 600px 이하의 `mw-app-panel`)를 아래로 끌어 닫게 해요.
 * 손잡이와 머리에서는 언제나, 내용에서는 맨 위까지 올라와 있을 때 끌려요. 높이의 3분의 1을 넘기거나 빠르게 내리면 닫혀요.
 * 닫힐 때의 움직임은 시트의 CSS 전환이 맡아요. 돌려주는 함수를 부르면 떼어 내요.
 */
export function sheetDrag(node: HTMLElement, { onClose, scrolls = '.mw-sheet__body, .mw-app-panel__body', when }: SheetDragOptions): () => void {
  let mode: 'idle' | 'pending' | 'drag' | 'off' = 'idle'
  let y0 = 0, dy = 0, scroller: HTMLElement | null = null
  const speed = speedometer()

  const start = (event: TouchEvent) => {
    const from = event.target as Element | null
    if (event.touches.length !== 1 || !from || (when && !when()) || from.closest(OWN_DRAG)) { mode = 'off'; return }
    const inside = from.closest<HTMLElement>(scrolls)
    scroller = inside && node.contains(inside) ? inside : null
    y0 = event.touches[0].clientY
    dy = 0
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
      // 위로 미는 것과, 내용이 아직 위로 더 남아 있을 때는 스크롤이에요
      if (dy < 0 || (scroller && scroller.scrollTop > 0)) { mode = 'off'; return }
      mode = 'drag'
      node.style.transition = 'none'
    }
    event.preventDefault()
    node.style.transform = `translate3d(0, ${Math.max(0, dy)}px, 0)`
  }
  const end = () => {
    const was = mode
    mode = 'idle'
    if (was !== 'drag') return
    node.style.transition = ''
    if (dy > node.getBoundingClientRect().height / 3 || speed.get() > 0.6) {
      // 닫힌 자리까지는 이 값으로 가고, 닫힌 뒤에는 아래의 정리에서 시트의 제 스타일로 돌아가요
      node.style.transform = 'translate3d(0, 105%, 0)'
      haptics.tap()
      onClose()
    } else node.style.transform = ''
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
    if (busy || event.touches.length !== 1 || !from || from.closest(OWN_DRAG)) { mode = 'off'; return }
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
