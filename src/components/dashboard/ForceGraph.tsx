import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { nodeRadius } from '@/services/graph/compute'
import type { GraphLink, GraphNode, LinkKind } from '@/services/graph/types'
import { resolveCssColor } from '@/utils/cssColor'
import { useTheme } from '@/mw/theme'
import { useGesture, useReducedMotion } from '@/mw/gestures'
import { EDGE_PX } from '@/mw/gesture-settings'

/* ────────────────────────────────────────────────────────────────
   지식 그래프 그리기 (Canvas)

   - 자리는 워커가 계산해 오고, 여기서는 캔버스 한 장에 그리기만 해요.
     SVG처럼 노드마다 DOM을 두지 않아 메모 수천 개도 부드러워요.
   - 그리기는 필요할 때만 한 프레임에 한 번(requestDraw).
   - 연결은 모양이 같은 것끼리 묶어 한 번에 그려요(stroke 호출 수 최소화).
   - 라벨은 화면 좌표에서 그리고, 큰 노드부터 자리를 잡아 겹치는 라벨은 건너뛰어요.
   - 새 레이아웃이 오면 옛 자리에서 새 자리로 옮겨 가요(움직임 줄이기면 바로).
   - 노드를 끌면 그때만 화면 쪽에서 작은 시뮬레이션을 돌려 이웃이 따라와요.
   - 키보드: 그래프에 포커스 → 화살표로 가까운 메모로, Enter로 고르고 한 번 더 Enter로 열기.
   ──────────────────────────────────────────────────────────────── */

export type LabelMode = 'none' | 'auto' | 'all'

export interface ForceGraphHandle {
  zoomIn(): void
  zoomOut(): void
  fit(animate?: boolean): void
  reset(): void
  focusNode(id: string): void
  exportPNG(): Promise<void>
}

interface ForceGraphProps {
  nodes: GraphNode[]
  links: GraphLink[]
  /** 노드 색 (var(--…) 그대로 줘도 돼요) */
  colorOf: (n: GraphNode) => string
  width: number
  height: number
  /** 팬/줌/드래그·키보드 (크게 보기=true, 위젯 미리보기=false) */
  interactive?: boolean
  labelMode?: LabelMode
  /** 제목에 이 말이 없는 노드는 흐리게 */
  query?: string
  /** 범례에서 고른 묶음 — false인 노드는 흐리게 */
  highlight?: ((n: GraphNode) => boolean) | null
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  /** 고른 노드를 다시 누르거나 Enter → 메모 열기 */
  onActivate?: (id: string) => void
  onZoomChange?: (pct: number) => void
  /** 노드를 끌어 바뀐 자리 */
  onMoved?: (nodes: Array<{ id: string; x: number; y: number }>) => void
  label?: string
  className?: string
}

interface RNode extends SimulationNodeDatum {
  id: string
  label: string
  degree: number
  ref: GraphNode
  x: number
  y: number
  r: number
  /** 옮겨 가는 중일 때의 출발 · 도착 자리 */
  fromX?: number
  fromY?: number
  toX?: number
  toY?: number
}
interface RLink extends SimulationLinkDatum<RNode> {
  source: RNode
  target: RNode
  kind: LinkKind
  weight: number
}

const MIN_K = 0.08
const MAX_K = 4
const TRANSITION_MS = 450
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)

function truncate(label: string, max: number): string {
  return label.length > max ? label.slice(0, max) + '…' : label
}

export const ForceGraph = forwardRef<ForceGraphHandle, ForceGraphProps>(function ForceGraph(
  {
    nodes,
    links,
    colorOf,
    width,
    height,
    interactive = false,
    labelMode = 'none',
    query = '',
    highlight = null,
    selectedId = null,
    onSelect,
    onActivate,
    onZoomChange,
    onMoved,
    label = '지식 그래프',
    className,
  },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { dark } = useTheme()
  const reduced = useReducedMotion()
  const pinchOn = useGesture('zoom')

  const rnodesRef = useRef<RNode[]>([])
  const rlinksRef = useRef<RLink[]>([])
  const byIdRef = useRef(new Map<string, RNode>())
  const adjRef = useRef(new Map<string, Set<string>>())
  const maxDegRef = useRef(0)
  const view = useRef({ x: 0, y: 0, k: 1 })
  const hoverRef = useRef<string | null>(null)
  const [keyFocus, setKeyFocus] = useState<string | null>(null)
  const keyFocusRef = useRef<string | null>(null)
  keyFocusRef.current = keyFocus
  const fittedRef = useRef(false)
  /** 전체 보기 배율 — 자동 라벨은 이 배율을 기준으로 나타나요 */
  const fitKRef = useRef(1)
  const sizeRef = useRef({ width, height })
  sizeRef.current = { width, height }
  const propsRef = useRef({ labelMode, query, highlight, selectedId, interactive, colorOf, reduced })
  propsRef.current = { labelMode, query, highlight, selectedId, interactive, colorOf, reduced }

  /* ── 색: var(--…)를 테마마다 한 번만 풀어요 ── */
  const colorCache = useRef(new Map<string, string>())
  const themeColors = useRef({ link: '', label: '', halo: '', dot: '', focus: '', bg: '', font: '' })
  useLayoutEffect(() => {
    colorCache.current.clear()
    const font = canvasRef.current ? getComputedStyle(canvasRef.current).fontFamily : 'sans-serif'
    themeColors.current = {
      link: resolveCssColor('var(--text-tertiary)'),
      label: resolveCssColor('var(--text-primary)'),
      halo: resolveCssColor('var(--background-primary)'),
      dot: resolveCssColor('var(--text-tertiary)'),
      focus: resolveCssColor('var(--mw-focus)'),
      bg: resolveCssColor('var(--background-primary)'),
      font: font || 'sans-serif',
    }
    requestDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark])
  const resolve = (c: string) => {
    let v = colorCache.current.get(c)
    if (!v) {
      v = resolveCssColor(c)
      colorCache.current.set(c, v)
    }
    return v
  }

  /* ── 그리기 ── */
  const rafRef = useRef<number | null>(null)
  const transitionRef = useRef<{ t0: number } | null>(null)

  const draw = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, background: boolean) => {
    const { labelMode: lm, query: q, highlight: hl, selectedId: sel, interactive: itv, colorOf: colorFn } = propsRef.current
    const tc = themeColors.current
    const { x: vx, y: vy, k } = view.current
    const rnodes = rnodesRef.current
    const rlinks = rlinksRef.current

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    if (background) {
      ctx.fillStyle = tc.bg
      ctx.fillRect(0, 0, w, h)
    }

    // 도트 격자 — 빈 곳에서도 움직임이 느껴지게 (너무 촘촘하면 생략)
    if (itv) {
      const step = 22 * k
      if (step >= 10) {
        ctx.fillStyle = tc.dot
        ctx.globalAlpha = dark ? 0.16 : 0.12
        const ox = ((vx % step) + step) % step
        const oy = ((vy % step) + step) % step
        for (let gx = ox; gx < w; gx += step) {
          for (let gy = oy; gy < h; gy += step) ctx.fillRect(gx - 0.6, gy - 0.6, 1.2, 1.2)
        }
        ctx.globalAlpha = 1
      }
    }

    let active = hoverRef.current ?? keyFocusRef.current ?? sel ?? null
    if (active != null && !byIdRef.current.has(active)) active = null
    const hood = active != null ? adjRef.current.get(active) : undefined
    const ql = q.trim().toLowerCase()
    const passes = (n: RNode) => (!hl || hl(n.ref)) && (!ql || n.label.toLowerCase().includes(ql))
    const pass = new Map<string, boolean>()
    for (const n of rnodes) pass.set(n.id, passes(n))

    // 화면 안에 있는지 (그래프 좌표 여유 포함)
    const left = -vx / k - 40
    const top = -vy / k - 40
    const right = (w - vx) / k + 40
    const bottom = (h - vy) / k + 40
    const inView = (n: RNode) => n.x >= left && n.x <= right && n.y >= top && n.y <= bottom

    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * vx, dpr * vy)

    // 연결 — 모양(점선 · 불투명도 · 굵기)이 같은 것끼리 묶어 한 번에
    const batches = new Map<string, number[]>()
    for (let i = 0; i < rlinks.length; i++) {
      const l = rlinks[i]
      const s = l.source
      const t = l.target
      if (!inView(s) && !inView(t)) continue
      const touches = active != null && (s.id === active || t.id === active)
      let op = active != null ? (touches ? (l.kind === 'wiki' ? 0.6 : 0.45) : 0.05) : l.kind === 'wiki' ? 0.28 : 0.16
      if (!pass.get(s.id) || !pass.get(t.id)) op = Math.min(op, 0.04)
      const lw = touches ? Math.min(1.4 + l.weight * 0.7, 4) : Math.min(1 + l.weight * 0.5, 3)
      const key = `${l.kind === 'wiki' ? 's' : 'd'}|${Math.round(op * 100)}|${Math.round(lw * 2)}`
      const arr = batches.get(key)
      if (arr) arr.push(i)
      else batches.set(key, [i])
    }
    ctx.strokeStyle = tc.link
    ctx.lineCap = 'round'
    for (const [key, idx] of batches) {
      const [dash, op, lw2] = key.split('|')
      ctx.globalAlpha = Number(op) / 100
      ctx.lineWidth = Number(lw2) / 2
      ctx.setLineDash(dash === 'd' ? [5, 4] : [])
      ctx.beginPath()
      for (const i of idx) {
        const l = rlinks[i]
        ctx.moveTo(l.source.x, l.source.y)
        ctx.lineTo(l.target.x, l.target.y)
      }
      ctx.stroke()
    }
    ctx.setLineDash([])
    ctx.globalAlpha = 1

    // 노드
    const dimOf = (n: RNode) => !pass.get(n.id) || (active != null && n.id !== active && !hood?.has(n.id))
    for (const n of rnodes) {
      if (!inView(n)) continue
      const color = resolve(colorFn(n.ref))
      const isActive = n.id === active
      const isSel = n.id === sel
      const dim = dimOf(n)
      const r = n.r * (isActive ? 1.45 : 1)
      ctx.globalAlpha = dim ? 0.14 : 1
      if (isActive) {
        ctx.shadowColor = color
        ctx.shadowBlur = 14
      }
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.globalAlpha = (dim ? 0.14 : 1) * (isActive ? 0.92 : 0.6)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.globalAlpha = dim ? 0.14 : 1
      ctx.lineWidth = isSel ? 2.5 : isActive ? 2 : 1.5
      ctx.strokeStyle = color
      ctx.stroke()
      if (n.id === keyFocusRef.current) {
        ctx.globalAlpha = 1
        ctx.lineWidth = 2 / k
        ctx.strokeStyle = tc.focus
        ctx.beginPath()
        ctx.arc(n.x, n.y, r + 4 / k, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // 라벨 — 화면 좌표, 중요한 노드부터 자리를 잡고 겹치면 건너뛰어요
    if (lm !== 'none' || active != null) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const fontSize = 12
      ctx.font = `${fontSize}px ${tc.font}`
      ctx.textBaseline = 'middle'
      ctx.lineJoin = 'round'
      const maxDeg = maxDegRef.current
      // 전체 보기에서도 큰 허브는 이름이 보이고, 확대할수록 작은 메모까지 (겹치는 라벨은 아래에서 건너뛰어요)
      const base = Math.min(fitKRef.current, 1)
      const span = rnodes.length <= 40 ? 0.6 : 2.2
      const candidates: Array<{ n: RNode; op: number; pri: number }> = []
      for (const n of rnodes) {
        if (!inView(n) || dimOf(n)) continue
        let op = 0
        const near = active != null && (n.id === active || hood?.has(n.id))
        if (lm === 'all') op = 1
        else if (lm === 'auto') {
          const ratio = maxDeg > 0 ? n.degree / maxDeg : 0
          const threshold = base * (0.6 + (1 - ratio) * span)
          op = clamp((k - threshold) / (base * 0.35), 0, 1)
        }
        if (near) op = 1
        if (op <= 0.02) continue
        candidates.push({ n, op, pri: (n.id === active ? 1e6 : near ? 1e5 : 0) + n.degree })
      }
      candidates.sort((a, b) => b.pri - a.pri)
      const boxes: Array<[number, number, number, number]> = []
      const budget = 400
      let drawn = 0
      ctx.lineWidth = 3
      ctx.strokeStyle = tc.halo
      ctx.fillStyle = tc.label
      for (const { n, op } of candidates) {
        if (drawn >= budget) break
        const text = truncate(n.label, 18)
        const sx = n.x * k + vx + n.r * k + 4
        const sy = n.y * k + vy
        const tw = ctx.measureText(text).width
        const box: [number, number, number, number] = [sx - 2, sy - fontSize / 2 - 1, sx + tw + 2, sy + fontSize / 2 + 1]
        if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue
        boxes.push(box)
        ctx.globalAlpha = op
        ctx.strokeText(text, sx, sy)
        ctx.fillText(text, sx, sy)
        drawn++
      }
      ctx.globalAlpha = 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark])

  const frame = useCallback(() => {
    rafRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // 옮겨 가는 중이면 자리를 한 걸음 진행
    const tr = transitionRef.current
    if (tr) {
      const p = Math.min((performance.now() - tr.t0) / TRANSITION_MS, 1)
      const e = ease(p)
      for (const n of rnodesRef.current) {
        if (n.toX == null || n.fromX == null) continue
        n.x = n.fromX + (n.toX - n.fromX) * e
        n.y = n.fromY! + (n.toY! - n.fromY!) * e
        if (p >= 1) n.fromX = n.fromY = n.toX = n.toY = undefined
      }
      if (p >= 1) transitionRef.current = null
    }
    const dpr = window.devicePixelRatio || 1
    draw(ctx, sizeRef.current.width, sizeRef.current.height, dpr, false)
    if (transitionRef.current) requestDraw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw])

  const requestDraw = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(frame)
  }, [frame])
  const drawRef = useRef(requestDraw)
  drawRef.current = requestDraw

  /* ── 뷰 ── */
  const lastPct = useRef(-1)
  const notifyZoom = useCallback(() => {
    const pct = Math.round(view.current.k * 100)
    if (pct === lastPct.current) return
    lastPct.current = pct
    onZoomChange?.(pct)
  }, [onZoomChange])

  const viewAnim = useRef<number | null>(null)
  const cancelViewAnim = () => {
    if (viewAnim.current !== null) cancelAnimationFrame(viewAnim.current)
    viewAnim.current = null
  }

  const computeFit = useCallback((): { x: number; y: number; k: number } | null => {
    const list = rnodesRef.current
    if (!list.length) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of list) {
      const x = n.toX ?? n.x
      const y = n.toY ?? n.y
      if (x - n.r < minX) minX = x - n.r
      if (y - n.r < minY) minY = y - n.r
      if (x + n.r > maxX) maxX = x + n.r
      if (y + n.r > maxY) maxY = y + n.r
    }
    const { width: w, height: h } = sizeRef.current
    const pad = propsRef.current.interactive ? 56 : 20
    const k = clamp(
      Math.min((w - pad * 2) / Math.max(maxX - minX, 1), (h - pad * 2) / Math.max(maxY - minY, 1)),
      MIN_K,
      propsRef.current.interactive ? 1.6 : 1.1
    )
    return { x: w / 2 - ((minX + maxX) / 2) * k, y: h / 2 - ((minY + maxY) / 2) * k, k }
  }, [])

  const animateView = useCallback(
    (target: { x: number; y: number; k: number }, duration = 400) => {
      cancelViewAnim()
      if (propsRef.current.reduced || duration <= 0) {
        view.current = { ...target }
        notifyZoom()
        requestDraw()
        return
      }
      const start = { ...view.current }
      const t0 = performance.now()
      const step = (now: number) => {
        const p = Math.min((now - t0) / duration, 1)
        const e = ease(p)
        view.current = {
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          k: start.k + (target.k - start.k) * e,
        }
        notifyZoom()
        requestDraw()
        viewAnim.current = p < 1 ? requestAnimationFrame(step) : null
      }
      viewAnim.current = requestAnimationFrame(step)
    },
    [notifyZoom, requestDraw]
  )

  const fit = useCallback(
    (animate = true) => {
      const t = computeFit()
      if (!t) return
      fitKRef.current = t.k
      animateView(t, animate ? 400 : 0)
    },
    [computeFit, animateView]
  )

  const zoomAt = useCallback(
    (newK: number, sx: number, sy: number) => {
      cancelViewAnim()
      const t = view.current
      const k = clamp(newK, MIN_K, MAX_K)
      const gx = (sx - t.x) / t.k
      const gy = (sy - t.y) / t.k
      view.current = { x: sx - gx * k, y: sy - gy * k, k }
      notifyZoom()
      requestDraw()
    },
    [notifyZoom, requestDraw]
  )

  const centerOn = useCallback(
    (id: string, k?: number) => {
      const n = byIdRef.current.get(id)
      if (!n) return
      const kk = k ?? view.current.k
      const x = n.toX ?? n.x
      const y = n.toY ?? n.y
      animateView({ x: sizeRef.current.width / 2 - x * kk, y: sizeRef.current.height / 2 - y * kk, k: kk })
    },
    [animateView]
  )

  const ensureVisible = useCallback(
    (id: string) => {
      const n = byIdRef.current.get(id)
      if (!n) return
      const { x, y, k } = view.current
      const sx = n.x * k + x
      const sy = n.y * k + y
      const pad = 48
      const { width: w, height: h } = sizeRef.current
      if (sx < pad || sx > w - pad || sy < pad || sy > h - pad) centerOn(id)
    },
    [centerOn]
  )

  /* ── 데이터 → 그리기용 노드 (옛 자리에서 새 자리로 옮겨 가요) ── */
  const dragSim = useRef<Simulation<RNode, RLink> | null>(null)
  useLayoutEffect(() => {
    const prev = byIdRef.current
    const next = new Map<string, RNode>()
    let moved = 0
    const rnodes: RNode[] = nodes.map((n) => {
      const old = prev.get(n.id)
      const r = nodeRadius(n.degree, interactive)
      if (old) {
        const far = Math.abs(old.x - n.x) + Math.abs(old.y - n.y) > 0.5
        const rn: RNode = { id: n.id, label: n.label, degree: n.degree, ref: n, r, x: old.x, y: old.y }
        if (far) {
          rn.fromX = old.x
          rn.fromY = old.y
          rn.toX = n.x
          rn.toY = n.y
          moved++
        }
        next.set(n.id, rn)
        return rn
      }
      const rn: RNode = { id: n.id, label: n.label, degree: n.degree, ref: n, r, x: n.x, y: n.y }
      next.set(n.id, rn)
      return rn
    })
    const adj = new Map<string, Set<string>>()
    for (const n of rnodes) adj.set(n.id, new Set())
    const rlinks: RLink[] = []
    for (const l of links) {
      const s = next.get(l.source)
      const t = next.get(l.target)
      if (!s || !t) continue
      rlinks.push({ source: s, target: t, kind: l.kind, weight: l.weight })
      adj.get(s.id)!.add(t.id)
      adj.get(t.id)!.add(s.id)
    }
    dragSim.current?.stop()
    dragSim.current = null
    rnodesRef.current = rnodes
    rlinksRef.current = rlinks
    byIdRef.current = next
    adjRef.current = adj
    maxDegRef.current = rnodes.reduce((m, n) => Math.max(m, n.degree), 0)

    if (moved > 0) {
      if (propsRef.current.reduced || !fittedRef.current) {
        for (const n of rnodes) {
          if (n.toX == null) continue
          n.x = n.toX
          n.y = n.toY!
          n.fromX = n.fromY = n.toX = n.toY = undefined
        }
        transitionRef.current = null
      } else transitionRef.current = { t0: performance.now() }
    }
    // 처음엔 맞춰 보기. 미리보기(위젯)는 결과가 바뀔 때마다 다시 맞춰요.
    if ((!fittedRef.current || !interactive) && rnodes.length && sizeRef.current.width > 4) {
      fittedRef.current = true
      fit(false)
    }
    requestDraw()
  }, [nodes, links, interactive, fit, requestDraw])

  // 고른 것 · 찾는 말 · 범례 · 라벨 방식이 바뀌면 다시 그려요
  useEffect(() => {
    requestDraw()
  }, [selectedId, query, highlight, labelMode, keyFocus, colorOf, requestDraw])

  // 크기 — 캔버스 해상도(devicePixelRatio)를 맞추고 다시 맞춰 보기
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || width < 4 || height < 4) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    if (rnodesRef.current.length) {
      fittedRef.current = true
      fit(false)
    }
    requestDraw()
  }, [width, height, fit, requestDraw])

  /* ── 노드 끌기: 그때만 작은 시뮬레이션 ── */
  const startDrag = useCallback(() => {
    if (!dragSim.current) {
      const rnodes = rnodesRef.current
      for (const n of rnodes) {
        if (n.toX != null) {
          n.x = n.toX
          n.y = n.toY!
          n.fromX = n.fromY = n.toX = n.toY = undefined
        }
      }
      transitionRef.current = null
      const home = new Map(rnodes.map((n) => [n.id, [n.x, n.y] as const]))
      dragSim.current = forceSimulation<RNode>(rnodes)
        .stop()
        .force(
          'link',
          forceLink<RNode, RLink>(rlinksRef.current)
            .distance((l) => (l.kind === 'wiki' ? 60 : 85))
            .strength((l) => clamp(l.weight * 0.25, 0.05, 0.8) * (l.kind === 'wiki' ? 1 : l.kind === 'semantic' ? 0.5 : 0.35))
        )
        .force('charge', forceManyBody<RNode>().strength(-100).distanceMax(500).theta(0.9))
        .force('x', forceX<RNode>((d) => home.get(d.id)![0]).strength(0.08))
        .force('y', forceY<RNode>((d) => home.get(d.id)![1]).strength(0.08))
        .force('collide', forceCollide<RNode>().radius((d) => d.r + 7).strength(0.8))
        .alphaDecay(0.06)
        .on('tick', () => {
          // 끈 자리를 결과 노드에도 적어 두어요 — 필터를 바꿔도 제자리로 튀지 않게
          for (const n of rnodesRef.current) {
            n.ref.x = n.x
            n.ref.y = n.y
          }
          drawRef.current()
        })
        .on('end', () => onMovedRef.current?.(rnodesRef.current.map((n) => ({ id: n.id, x: n.x, y: n.y }))))
    }
    dragSim.current.alphaTarget(0.25).restart()
  }, [])
  const onMovedRef = useRef(onMoved)
  onMovedRef.current = onMoved

  const endDrag = useCallback((id: string) => {
    const n = byIdRef.current.get(id)
    if (n) {
      n.fx = null
      n.fy = null
    }
    dragSim.current?.alphaTarget(0)
  }, [])

  /* ── 누르기 · 끌기 · 확대 (포인터 이벤트 그대로 — 손짓 라이브러리 없이) ── */
  const toLocal = (clientX: number, clientY: number): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return [clientX - rect.left, clientY - rect.top]
  }
  const toGraph = (sx: number, sy: number): [number, number] => {
    const t = view.current
    return [(sx - t.x) / t.k, (sy - t.y) / t.k]
  }
  const hitTest = useCallback((sx: number, sy: number): string | null => {
    const [gx, gy] = toGraph(sx, sy)
    const slop = 4 / view.current.k
    const list = rnodesRef.current
    let best: string | null = null
    let bestD = Infinity
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i]
      const d = Math.hypot(n.x - gx, n.y - gy)
      if (d <= n.r + slop && d < bestD) {
        best = n.id
        bestD = d
      }
    }
    return best
  }, [])

  const handleTap = useCallback(
    (id: string | null) => {
      if (id == null) {
        onSelect?.(null)
        return
      }
      if (propsRef.current.selectedId === id) onActivate?.(id)
      else onSelect?.(id)
    },
    [onSelect, onActivate]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !interactive) return
    const pointers = new Map<number, { x: number; y: number }>()
    let mode: 'none' | 'pan' | 'node' | 'pinch' = 'none'
    let nodeId: string | null = null
    let dragging = false
    let start = { x: 0, y: 0 }
    let pinchStart = { d: 1, k: 1 }
    let lastTapWasDrag = false

    const down = (e: PointerEvent) => {
      // 화면 가장자리에서 시작한 터치는 기기의 뒤로 가기 손짓에 맡겨요
      if (e.pointerType === 'touch' && (e.clientX < EDGE_PX || e.clientX > window.innerWidth - EDGE_PX)) return
      if (e.button !== 0 && e.pointerType === 'mouse') return
      canvas.setPointerCapture(e.pointerId)
      const [sx, sy] = toLocal(e.clientX, e.clientY)
      pointers.set(e.pointerId, { x: sx, y: sy })
      if (pointers.size === 2 && pinchOn) {
        const [a, b] = [...pointers.values()]
        pinchStart = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, k: view.current.k }
        if (mode === 'node' && nodeId && dragging) endDrag(nodeId)
        mode = 'pinch'
        return
      }
      if (pointers.size > 1) return
      cancelViewAnim()
      start = { x: sx, y: sy }
      dragging = false
      nodeId = hitTest(sx, sy)
      mode = nodeId ? 'node' : 'pan'
    }
    const move = (e: PointerEvent) => {
      const [sx, sy] = toLocal(e.clientX, e.clientY)
      if (!pointers.has(e.pointerId)) {
        // 마우스를 올린 채 움직임 — 가리킨 노드 강조
        if (e.pointerType !== 'mouse') return
        const id = hitTest(sx, sy)
        canvas.style.cursor = id ? 'pointer' : 'grab'
        if (id !== hoverRef.current) {
          hoverRef.current = id
          requestDraw()
        }
        return
      }
      const prev = pointers.get(e.pointerId)!
      pointers.set(e.pointerId, { x: sx, y: sy })
      if (mode === 'pinch') {
        if (pointers.size < 2) return
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        zoomAt(pinchStart.k * (d / pinchStart.d), (a.x + b.x) / 2, (a.y + b.y) / 2)
        return
      }
      if (!dragging && Math.hypot(sx - start.x, sy - start.y) > 3) {
        dragging = true
        if (mode === 'node') startDrag()
        canvas.style.cursor = 'grabbing'
      }
      if (!dragging) return
      if (mode === 'pan') {
        view.current = { ...view.current, x: view.current.x + (sx - prev.x), y: view.current.y + (sy - prev.y) }
        requestDraw()
      } else if (mode === 'node' && nodeId) {
        const n = byIdRef.current.get(nodeId)
        if (n) {
          const [gx, gy] = toGraph(sx, sy)
          n.fx = gx
          n.fy = gy
        }
      }
    }
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.delete(e.pointerId)
      if (mode === 'pinch') {
        if (pointers.size === 0) mode = 'none'
        lastTapWasDrag = true
        return
      }
      if (pointers.size > 0) return
      if (mode === 'node' && nodeId && dragging) endDrag(nodeId)
      if (!dragging && e.type === 'pointerup') handleTap(nodeId)
      lastTapWasDrag = dragging
      mode = 'none'
      nodeId = null
      dragging = false
      canvas.style.cursor = 'grab'
    }
    const leave = () => {
      if (hoverRef.current) {
        hoverRef.current = null
        requestDraw()
      }
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const [sx, sy] = toLocal(e.clientX, e.clientY)
      zoomAt(view.current.k * Math.exp(-e.deltaY * 0.0015), sx, sy)
    }
    // 빈 곳을 두 번 누르면 전체 보기 (끈 직후에 OS가 만드는 두 번 누르기는 무시)
    const dbl = (e: MouseEvent) => {
      if (lastTapWasDrag) return
      const [sx, sy] = toLocal(e.clientX, e.clientY)
      if (!hitTest(sx, sy)) fit(true)
    }
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('wheel', wheel, { passive: false })
    canvas.addEventListener('dblclick', dbl)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('wheel', wheel)
      canvas.removeEventListener('dblclick', dbl)
    }
  }, [interactive, pinchOn, hitTest, handleTap, zoomAt, fit, requestDraw, startDrag, endDrag])

  /* ── 키보드 ── */
  const moveFocus = useCallback(
    (dx: number, dy: number) => {
      const list = rnodesRef.current
      if (!list.length) return
      const cur = keyFocusRef.current ? byIdRef.current.get(keyFocusRef.current) : null
      if (!cur) {
        const sel = propsRef.current.selectedId
        const first = (sel && byIdRef.current.get(sel)) || list.reduce((a, b) => (b.degree > a.degree ? b : a))
        setKeyFocus(first.id)
        ensureVisible(first.id)
        return
      }
      // 그 방향(±60°) 안에서 가장 가까운 노드
      let best: RNode | null = null
      let bestScore = Infinity
      for (const n of list) {
        if (n === cur) continue
        const vx = n.x - cur.x
        const vy = n.y - cur.y
        const along = vx * dx + vy * dy
        if (along <= 0) continue
        const dist = Math.hypot(vx, vy)
        if (along / dist < 0.5) continue
        const score = dist * (2 - along / dist)
        if (score < bestScore) {
          bestScore = score
          best = n
        }
      }
      if (best) {
        setKeyFocus(best.id)
        ensureVisible(best.id)
      }
    },
    [ensureVisible]
  )

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (dir[e.key]) {
      e.preventDefault()
      moveFocus(...dir[e.key])
    } else if ((e.key === 'Enter' || e.key === ' ') && keyFocusRef.current) {
      e.preventDefault()
      handleTap(keyFocusRef.current)
    }
  }

  const focused = keyFocus ? byIdRef.current.get(keyFocus) : null
  const liveText = useMemo(() => {
    if (!focused) return ''
    const chosen = focused.id === selectedId ? ' · 골랐어요. Enter로 열어요' : ''
    return `${focused.label} — 연결 ${focused.degree}개${chosen}`
  }, [focused, selectedId])

  /* ── 밖으로 여는 조작 ── */
  useImperativeHandle(
    ref,
    (): ForceGraphHandle => ({
      zoomIn: () => zoomAt(view.current.k * 1.3, sizeRef.current.width / 2, sizeRef.current.height / 2),
      zoomOut: () => zoomAt(view.current.k / 1.3, sizeRef.current.width / 2, sizeRef.current.height / 2),
      fit,
      reset: () => {
        onSelect?.(null)
        fit(true)
      },
      focusNode: (id) => {
        centerOn(id, clamp(Math.max(view.current.k, 1.2), MIN_K, MAX_K))
        onSelect?.(id)
      },
      exportPNG: async () => {
        const { width: w, height: h } = sizeRef.current
        const scale = 2
        const off = document.createElement('canvas')
        off.width = w * scale
        off.height = h * scale
        const ctx = off.getContext('2d')
        if (!ctx) throw new Error('canvas')
        draw(ctx, w, h, scale, true)
        const blob = await new Promise<Blob | null>((res) => off.toBlob(res, 'image/png'))
        if (!blob) throw new Error('blob')
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = '지식그래프.png'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      },
    }),
    [zoomAt, fit, centerOn, onSelect, draw]
  )

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
      cancelViewAnim()
      dragSim.current?.stop()
    },
    []
  )

  if (!interactive) {
    return (
      <div className={className} style={{ width, height }}>
        <canvas ref={canvasRef} role="img" aria-label={label} className="block" style={{ width, height }} />
      </div>
    )
  }

  return (
    <div
      className={className}
      style={{ width, height }}
      role="application"
      aria-roledescription="그래프"
      aria-label={`${label} — 화살표로 메모를 옮겨 다니고 Enter로 골라요`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={(e) => {
        if (e.target === e.currentTarget && !keyFocusRef.current) moveFocus(0, 0)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyFocus(null)
      }}
    >
      <canvas
        ref={canvasRef}
        className="block select-none"
        style={{ width, height, touchAction: 'none', cursor: 'grab' }}
      />
      <p className="mw-sr-only" aria-live="polite">
        {liveText}
      </p>
    </div>
  )
})
