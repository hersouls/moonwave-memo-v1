/* Moonwave UX — ImageViewer (사진 크게 보기: 확대하고 넘기기)
   손가락: 두 손가락으로 벌려 확대(4배까지), 두 번 탭으로 확대 · 되돌리기, 확대한 채 끌어 옮기기, 옆으로 밀어 넘기기, 아래로 내려 닫기.
   버튼과 키보드로 같은 일을 다 해요: 이전 · 다음, 크게 · 작게 보기, 닫기, ← → + − 0, Esc와 뒤로 가기.
   손짓은 ‘사진 확대 · 넘기기’(표준)를 따르고, 꺼져 있으면 붙이지 않아요.
   규격: https://ux.moonwave.kr/patterns/touch-gestures#viewer */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { useCloseRequest } from './close'
import { DOUBLE_TAP_MS, EDGE_PX, reducedMotion, SWIPE_SPEED, swipeDistance } from './gesture-settings'
import { useGesture } from './gestures'
import { haptics } from './haptics'
import { IcLineClose, IcMwNext, IcMwPrev, IcMwZoomIn, IcMwZoomOut } from './icons'

export type ViewerImage = {
  src: string
  /** 사진이 무엇인지예요. 화면 읽기 프로그램이 읽어요. */
  alt: string
  srcSet?: string
  sizes?: string
}

export type ImageViewerProps = {
  open: boolean
  onClose: () => void
  images: readonly ViewerImage[]
  /** 지금 사진의 차례예요(0부터). */
  index: number
  onIndexChange: (index: number) => void
  /** 보기의 이름이에요. 기본은 `사진 보기`예요. */
  label?: string
}

/** 가장 크게 볼 수 있는 배율과, 두 번 탭했을 때의 배율이에요. */
const MAX = 4
const DOUBLE = 2.5
type Zoom = { s: number; x: number; y: number }
const FIT: Zoom = { s: 1, x: 0, y: 0 }

/** 열려 있을 때만 그려요. `document.body`에 그려요. */
export function ImageViewer(props: ImageViewerProps) {
  if (!props.open || props.images.length === 0) return null
  return createPortal(<ViewerBody {...props} />, document.body)
}

function ViewerBody({ onClose, images, index, onIndexChange, label = '사진 보기' }: ImageViewerProps) {
  const zoomOn = useGesture('zoom')
  const root = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)
  const z = useRef<Zoom>(FIT)
  const [scale, setScale] = useState(1)
  const at = useRef(index)
  // 손짓은 한 번 붙이고, 부르는 쪽의 함수는 늘 지금 것을 써요
  const cb = useRef({ onClose, onIndexChange })
  useLayoutEffect(() => { at.current = index; cb.current = { onClose, onIndexChange } })
  useCloseRequest(true, onClose)

  // 열려 있는 동안 뒤 화면은 스크롤되지 않고, 닫히면 열었던 곳으로 포커스가 돌아가요
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeBtn.current?.focus({ preventScroll: true })
    return () => { document.body.style.overflow = overflow; if (back?.isConnected) back.focus({ preventScroll: true }) }
  }, [])

  const paint = useCallback((glide: boolean) => {
    const el = img.current
    if (!el) return
    const { s, x, y } = z.current
    el.style.transition = glide && !reducedMotion() ? 'transform var(--motion-duration-medium) var(--motion-easing-ease-out)' : 'none'
    el.style.transform = s === 1 && !x && !y ? '' : `translate3d(${x}px, ${y}px, 0) scale(${s})`
  }, [])
  /** 확대한 사진이 화면 밖으로 너무 나가지 않게 옮길 수 있는 거리예요. */
  const bound = (s: number) => {
    const el = img.current, st = stage.current
    if (!el || !st) return { x: 0, y: 0 }
    return { x: Math.max(0, (el.offsetWidth * s - st.clientWidth) / 2), y: Math.max(0, (el.offsetHeight * s - st.clientHeight) / 2) }
  }
  const clampZoom = (q: Zoom): Zoom => {
    const s = Math.max(1, Math.min(MAX, q.s))
    const b = bound(s)
    return { s, x: Math.max(-b.x, Math.min(b.x, q.x)), y: Math.max(-b.y, Math.min(b.y, q.y)) }
  }
  /** 화면의 한 점(무대 가운데 기준)을 그 자리에 둔 채 배율을 바꿔요. */
  const zoomAround = (s: number, px = 0, py = 0) => {
    const now = z.current
    const k = s / now.s
    const next = clampZoom({ s, x: px - k * (px - now.x), y: py - k * (py - now.y) })
    if (next.s === now.s && (s > MAX || s < 1)) haptics.edge()
    z.current = next
    paint(true)
    setScale(next.s)
  }
  const reset = () => { z.current = FIT; paint(true); setScale(1) }
  useLayoutEffect(() => { z.current = FIT; paint(false); setScale(1) }, [index, paint])

  // 옆 사진으로: 줄이 옆으로 밀려 간 뒤 차례가 바뀌어요
  const go = (d: -1 | 1) => {
    const next = at.current + d
    if (next < 0 || next >= images.length) { haptics.edge(); slide(0); return }
    haptics.select()
    const t = track.current
    if (!t || reducedMotion()) { cb.current.onIndexChange(next); return }
    t.style.transition = 'transform var(--motion-duration-medium) var(--motion-easing-ease-out)'
    t.style.transform = `translate3d(${-d * 100}%, 0, 0)`
    const done = () => {
      t.removeEventListener('transitionend', done)
      flushSync(() => cb.current.onIndexChange(next))
      t.style.transition = 'none'
      t.style.transform = ''
    }
    t.addEventListener('transitionend', done)
  }
  const slide = (px: number, glide = true) => {
    const t = track.current
    if (!t) return
    t.style.transition = glide && !reducedMotion() ? 'transform var(--motion-duration-medium) var(--motion-easing-ease-out)' : 'none'
    t.style.transform = px ? `translate3d(${px}px, 0, 0)` : ''
  }
  const pull = (px: number, glide = false) => {
    const r = root.current
    if (!r) return
    r.style.setProperty('--mw-viewer-pull', String(Math.min(1, px / 400)))
    const st = stage.current
    if (st) {
      st.style.transition = glide && !reducedMotion() ? 'transform var(--motion-duration-medium) var(--motion-easing-ease-out)' : 'none'
      st.style.transform = px ? `translate3d(0, ${px}px, 0)` : ''
    }
  }

  // 손가락: 이 무대 안의 손짓은 모두 여기서 받아요(브라우저의 확대와 스크롤은 쉬어요)
  useEffect(() => {
    const st = stage.current
    if (!st || !zoomOn) return
    type Mode = 'idle' | 'pending' | 'pan' | 'page' | 'pull' | 'pinch' | 'off'
    let mode: Mode = 'idle'
    let p0 = { x: 0, y: 0 }, z0: Zoom = FIT, d0 = 0, mid0 = { x: 0, y: 0 }, last = { x: 0, y: 0 }, moved = false
    let samples: { t: number; x: number; y: number }[] = []
    let tap = { t: 0, x: 0, y: 0 }
    const center = () => { const r = st.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
    const mid = (a: Touch, b: Touch) => { const c = center(); return { x: (a.clientX + b.clientX) / 2 - c.x, y: (a.clientY + b.clientY) / 2 - c.y } }
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
    const sample = (x: number, y: number) => { const t = performance.now(); samples.push({ t, x, y }); while (samples.length > 2 && t - samples[0].t > 100) samples.shift() }
    const speed = () => { if (samples.length < 2) return { x: 0, y: 0 }; const a = samples[0], b = samples[samples.length - 1], dt = Math.max(1, b.t - a.t); return { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt } }
    const startOne = (t: Touch) => { p0 = { x: t.clientX, y: t.clientY }; last = p0; z0 = z.current; samples = []; sample(t.clientX, t.clientY); mode = 'pending'; moved = false }

    const start = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const [a, b] = [e.touches[0], e.touches[1]]
        mode = 'pinch'; d0 = dist(a, b); mid0 = mid(a, b); z0 = z.current; moved = true
        slide(0); pull(0)
        return
      }
      if (e.touches.length !== 1) return
      const t = e.touches[0]
      if (t.clientX < EDGE_PX || t.clientX > innerWidth - EDGE_PX) { mode = 'off'; return }
      startOne(t)
    }
    const move = (e: TouchEvent) => {
      if (e.cancelable) e.preventDefault()
      if (mode === 'pinch' && e.touches.length >= 2) {
        const [a, b] = [e.touches[0], e.touches[1]]
        const m = mid(a, b)
        const s = Math.max(0.85, Math.min(MAX * 1.15, z0.s * (dist(a, b) / d0)))
        const q = { x: (mid0.x - z0.x) / z0.s, y: (mid0.y - z0.y) / z0.s }
        z.current = { s, x: m.x - s * q.x, y: m.y - s * q.y }
        paint(false)
        return
      }
      const t = e.touches[0]
      if (!t || mode === 'off' || mode === 'idle') return
      sample(t.clientX, t.clientY)
      last = { x: t.clientX, y: t.clientY }
      const dx = t.clientX - p0.x, dy = t.clientY - p0.y
      if (mode === 'pending') {
        if (Math.hypot(dx, dy) < 8) return
        moved = true
        mode = z0.s > 1.01 ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'page' : dy > 0 ? 'pull' : 'off'
      }
      if (mode === 'pan') {
        const b = bound(z0.s)
        const give = (v: number, lim: number) => (Math.abs(v) <= lim ? v : Math.sign(v) * (lim + (Math.abs(v) - lim) * 0.3))
        z.current = { s: z0.s, x: give(z0.x + dx, b.x), y: give(z0.y + dy, b.y) }
        paint(false)
      } else if (mode === 'page') {
        const i = at.current, edge = (dx > 0 && i === 0) || (dx < 0 && i === images.length - 1)
        slide(edge ? dx * 0.3 : dx, false)
      } else if (mode === 'pull') pull(Math.max(0, dy))
    }
    const end = (e: TouchEvent) => {
      const was = mode
      if (was === 'pinch') {
        if (e.touches.length === 1) { startOne(e.touches[0]); mode = 'pending'; z0 = z.current }
        else mode = 'idle'
        const q = z.current
        if (q.s > MAX) haptics.edge()
        z.current = q.s <= 1 ? FIT : clampZoom(q)
        paint(true)
        setScale(z.current.s)
        return
      }
      if (e.touches.length) return
      mode = 'idle'
      const v = speed(), dx = last.x - p0.x, dy = last.y - p0.y
      if (was === 'pan') { z.current = clampZoom(z.current); paint(true); return }
      if (was === 'page') {
        if (dx <= -swipeDistance() || v.x <= -SWIPE_SPEED) go(1)
        else if (dx >= swipeDistance() || v.x >= SWIPE_SPEED) go(-1)
        else slide(0)
        return
      }
      if (was === 'pull') {
        if (dy > 120 || v.y > 0.6) { haptics.tap(); cb.current.onClose() } else pull(0, true)
        return
      }
      if (was === 'pending' && !moved) {
        // 두 번 탭: 확대했으면 되돌리고, 아니면 그 자리를 크게
        const now = performance.now()
        if (now - tap.t < DOUBLE_TAP_MS && Math.hypot(p0.x - tap.x, p0.y - tap.y) < 32) {
          tap = { t: 0, x: 0, y: 0 }
          if (z.current.s > 1.01) reset()
          else { const c = center(); zoomAround(DOUBLE, p0.x - c.x, p0.y - c.y) }
          haptics.tap()
        } else tap = { t: now, x: p0.x, y: p0.y }
      }
    }
    st.addEventListener('touchstart', start, { passive: true })
    st.addEventListener('touchmove', move, { passive: false })
    st.addEventListener('touchend', end)
    st.addEventListener('touchcancel', end)
    st.setAttribute('data-mw-hands', '')
    return () => {
      st.removeAttribute('data-mw-hands')
      st.removeEventListener('touchstart', start)
      st.removeEventListener('touchmove', move)
      st.removeEventListener('touchend', end)
      st.removeEventListener('touchcancel', end)
    }
    // 이 손짓은 사진 수와 설정이 바뀔 때만 다시 붙여요. 나머지는 ref로 읽어요
  }, [zoomOn, images.length])

  // 마우스: Ctrl(⌘) + 휠로 확대, 확대한 사진은 끌어 옮겨요
  useEffect(() => {
    const st = stage.current
    if (!st) return
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = st.getBoundingClientRect()
      zoomAround(z.current.s * Math.exp(-e.deltaY * 0.01), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2)
    }
    let grab: { x: number; y: number; z: Zoom } | null = null
    const down = (e: PointerEvent) => { if (e.pointerType === 'mouse' && z.current.s > 1) { grab = { x: e.clientX, y: e.clientY, z: z.current }; st.setPointerCapture(e.pointerId) } }
    const move = (e: PointerEvent) => { if (!grab) return; z.current = clampZoom({ ...grab.z, x: grab.z.x + e.clientX - grab.x, y: grab.z.y + e.clientY - grab.y }); paint(false) }
    const up = () => { grab = null }
    st.addEventListener('wheel', wheel, { passive: false })
    st.addEventListener('pointerdown', down)
    st.addEventListener('pointermove', move)
    st.addEventListener('pointerup', up)
    st.addEventListener('pointercancel', up)
    return () => {
      st.removeEventListener('wheel', wheel)
      st.removeEventListener('pointerdown', down)
      st.removeEventListener('pointermove', move)
      st.removeEventListener('pointerup', up)
      st.removeEventListener('pointercancel', up)
    }
  }, [])

  const keys = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const k = e.key
    if (k === 'ArrowLeft') go(-1)
    else if (k === 'ArrowRight') go(1)
    else if (k === '+' || k === '=') zoomAround(z.current.s * 1.5)
    else if (k === '-') zoomAround(z.current.s / 1.5)
    else if (k === '0') reset()
    else return
    e.preventDefault()
  }

  const slides = [index - 1, index, index + 1]
  return (
    <div ref={root} className="mw-viewer" role="dialog" aria-modal="true" aria-label={label} onKeyDown={keys}>
      <div className="mw-viewer__top">
        <span className="mw-viewer__pos" aria-live="polite">{index + 1} / {images.length}</span>
        <span className="mw-viewer__spacer" />
        <button type="button" className="mw-viewer__button" aria-label="작게 보기" disabled={scale <= 1} onClick={() => (z.current.s / 1.5 <= 1.01 ? reset() : zoomAround(z.current.s / 1.5))}><IcMwZoomOut size={24} /></button>
        <button type="button" className="mw-viewer__button" aria-label="크게 보기" disabled={scale >= MAX} onClick={() => zoomAround(z.current.s * 1.5)}><IcMwZoomIn size={24} /></button>
        <button ref={closeBtn} type="button" className="mw-viewer__button" aria-label="닫기" onClick={onClose}><IcLineClose size={24} /></button>
      </div>
      <div ref={stage} className="mw-viewer__stage">
        <div ref={track} className="mw-viewer__track">
          {slides.map((i, k) => {
            const p = images[i]
            if (!p) return null
            return (
              <div key={i} className="mw-viewer__slide" style={{ left: `${(k - 1) * 100}%` }} aria-hidden={i !== index || undefined}>
                <img ref={i === index ? img : undefined} className="mw-viewer__img" src={p.src} srcSet={p.srcSet} sizes={p.sizes} alt={p.alt} draggable={false} decoding="async" />
              </div>
            )
          })}
        </div>
      </div>
      <button type="button" className="mw-viewer__nav mw-viewer__nav--prev" aria-label="이전 사진" disabled={index === 0} onClick={() => go(-1)}><IcMwPrev size={24} /></button>
      <button type="button" className="mw-viewer__nav mw-viewer__nav--next" aria-label="다음 사진" disabled={index === images.length - 1} onClick={() => go(1)}><IcMwNext size={24} /></button>
    </div>
  )
}
