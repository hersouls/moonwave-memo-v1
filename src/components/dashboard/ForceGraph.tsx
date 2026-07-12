import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from 'react'
import { useGesture } from '@use-gesture/react'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import { toPng } from 'html-to-image'
import type { GraphLink, GraphNode } from '@/hooks/useGraphData'

/* ────────────────────────────────────────────────────────────────
   지식 그래프 렌더 엔진 (ForceGraph)

   d3-force로 레이아웃만 계산하고, DOM은 React가 구조만 그린 뒤
   위치·강조는 ref를 통해 명령형으로 갱신한다("구조는 React, 애니메이션은
   명령형" 패턴). 팬/줌/노드 드래그는 @use-gesture로 마우스·터치 모두 지원.

   핵심 개선:
   - 레이아웃 정착 후 fit-to-view로 뷰포트에 항상 맞춤 → "안 보이는" 문제 해결
   - forceX/forceY 약한 중심 인력 + distanceMax로 분산 억제
   - 팬/줌은 뷰포트 <g>의 transform만 setAttribute → React 리렌더 없이 부드럽게
   ──────────────────────────────────────────────────────────────── */

export const GROUP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#f43f5e', '#0ea5e9',
]

export function buildColorMap(groups: string[]): Map<string, string> {
  const map = new Map<string, string>()
  groups.forEach((g, i) => map.set(g, GROUP_COLORS[i % GROUP_COLORS.length]))
  return map
}

export type LabelMode = 'none' | 'hubs' | 'all'

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
  colorMap: Map<string, string>
  width: number
  height: number
  /** 팬/줌/드래그·호버 상호작용 활성화 (모달=true, 위젯 미리보기=false) */
  interactive?: boolean
  labelMode?: LabelMode
  /** 검색 강조 — 일치하지 않는 노드를 흐리게 */
  query?: string
  /** 범례에서 선택된 그룹만 강조 */
  highlightGroup?: string | null
  /** 부모가 소유한 선택 상태(제어형) — 상세 패널 표시용 */
  selectedId?: string | null
  onSelect?: (id: string | null) => void
  /** 이미 선택된 노드를 다시 탭하거나 상세에서 열기 → 메모로 이동 */
  onActivate?: (id: string) => void
  onZoomChange?: (pct: number) => void
  className?: string
}

interface SimNode extends SimulationNodeDatum, GraphNode {
  x: number
  y: number
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number
}

interface GraphInternal {
  simulation: ReturnType<typeof forceSimulation<SimNode>>
  simNodes: SimNode[]
  simLinks: SimLink[]
  simNodeById: Map<string, SimNode>
  adjacency: Map<string, Set<string>>
  hubSet: Set<string>
}

const MIN_K = 0.2
const MAX_K = 4

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function nodeRadius(degree: number, interactive: boolean): number {
  const base = interactive ? 5.5 : 4
  const grow = interactive ? 2 : 1.3
  const cap = interactive ? 11 : 7
  return base + Math.min(Math.sqrt(degree) * grow, cap)
}

function truncate(label: string, max: number): string {
  return label.length > max ? label.slice(0, max) + '…' : label
}

/* 구조 전용 레이어 — 데이터가 바뀔 때만 리렌더(memo).
   상호작용(선택/호버/줌)은 이 레이어를 다시 그리지 않고 ref로 갱신한다. */
interface GraphContentProps {
  nodes: GraphNode[]
  links: GraphLink[]
  colorMap: Map<string, string>
  interactive: boolean
  nodeRefs: MutableRefObject<Map<string, SVGGElement>>
  circleRefs: MutableRefObject<Map<string, SVGCircleElement>>
  labelRefs: MutableRefObject<Map<string, SVGTextElement>>
  linkRefs: MutableRefObject<(SVGLineElement | null)[]>
}

const GraphContent = memo(function GraphContent({
  nodes,
  links,
  colorMap,
  interactive,
  nodeRefs,
  circleRefs,
  labelRefs,
  linkRefs,
}: GraphContentProps) {
  return (
    <>
      <g className="text-zinc-400 dark:text-zinc-500">
        {links.map((l, i) => (
          <line
            key={`${l.source}-${l.target}-${i}`}
            ref={(el) => {
              linkRefs.current[i] = el
            }}
            stroke="currentColor"
            strokeLinecap="round"
            style={{ strokeOpacity: 0.22, strokeWidth: Math.min(1 + l.weight * 0.5, 3) }}
          />
        ))}
      </g>
      <g>
        {nodes.map((n) => {
          const color = colorMap.get(n.group) || '#a1a1aa'
          return (
            <g
              key={n.id}
              data-node-id={n.id}
              ref={(el) => {
                if (el) nodeRefs.current.set(n.id, el)
                else nodeRefs.current.delete(n.id)
              }}
              tabIndex={interactive ? 0 : undefined}
              role={interactive ? 'button' : undefined}
              aria-label={interactive ? `${n.label} — 연결 ${n.degree}개` : undefined}
              className={interactive ? 'outline-none [&:focus-visible>circle]:stroke-[3]' : undefined}
              style={{ cursor: interactive ? 'pointer' : 'default', willChange: 'transform' }}
            >
              <circle
                ref={(el) => {
                  if (el) circleRefs.current.set(n.id, el)
                  else circleRefs.current.delete(n.id)
                }}
                r={nodeRadius(n.degree, interactive)}
                fill={color}
                fillOpacity={0.6}
                stroke={color}
                strokeWidth={1.5}
              />
              <text
                ref={(el) => {
                  if (el) labelRefs.current.set(n.id, el)
                  else labelRefs.current.delete(n.id)
                }}
                x={nodeRadius(n.degree, interactive) + 4}
                y={4}
                fontSize={11}
                className="fill-zinc-700 dark:fill-zinc-200"
                style={{ opacity: 0, pointerEvents: 'none', paintOrder: 'stroke' }}
                stroke="var(--dialog-bg, transparent)"
                strokeWidth={3}
              >
                {truncate(n.label, 16)}
              </text>
            </g>
          )
        })}
      </g>
    </>
  )
})

export const ForceGraph = forwardRef<ForceGraphHandle, ForceGraphProps>(function ForceGraph(
  {
    nodes,
    links,
    colorMap,
    width,
    height,
    interactive = false,
    labelMode = 'none',
    query = '',
    highlightGroup = null,
    selectedId = null,
    onSelect,
    onActivate,
    onZoomChange,
    className,
  },
  ref
) {
  const svgRef = useRef<SVGSVGElement>(null)
  const viewRef = useRef<SVGGElement>(null)
  const exportRef = useRef<HTMLDivElement>(null)

  const nodeRefs = useRef(new Map<string, SVGGElement>())
  const circleRefs = useRef(new Map<string, SVGCircleElement>())
  const labelRefs = useRef(new Map<string, SVGTextElement>())
  const linkRefs = useRef<(SVGLineElement | null)[]>([])

  const graphRef = useRef<GraphInternal | null>(null)
  const viewTransform = useRef({ x: 0, y: 0, k: 1 })
  const rafRef = useRef<number | null>(null)
  const hoveredRef = useRef<string | null>(null)
  // 재구성 사이에 노드 위치를 이어받기 위한 저장소 — 데이터 변경 시 레이아웃 유지
  const positionsRef = useRef(new Map<string, { x: number; y: number }>())
  const sizeRef = useRef({ width, height })
  sizeRef.current = { width, height }

  // 호버/이펙트에서 항상 최신 prop을 읽도록 미러링
  const propsRef = useRef({ labelMode, query, highlightGroup, selectedId, interactive })
  propsRef.current = { labelMode, query, highlightGroup, selectedId, interactive }

  const hasSize = width > 4 && height > 4
  const enoughNodes = nodes.length >= 1

  // 구조(노드·링크 집합) 서명 — 라벨만 바뀌는 변경에는 시뮬레이션을 재구성하지 않도록.
  // 순서와 무관하게 안정적이도록 정렬한다.
  const structureKey = useMemo(() => {
    const ns = nodes.map((n) => n.id).sort().join(',')
    const ls = links
      .map((l) => (l.source < l.target ? `${l.source}~${l.target}` : `${l.target}~${l.source}`))
      .sort()
      .join(',')
    return `${ns}||${ls}`
  }, [nodes, links])

  /* ── 뷰포트 transform 적용 (명령형, 리렌더 없음) ── */
  const applyTransform = useCallback(() => {
    const g = viewRef.current
    if (!g) return
    const { x, y, k } = viewTransform.current
    g.setAttribute('transform', `translate(${x},${y}) scale(${k})`)
  }, [])

  const notifyZoom = useCallback(() => {
    onZoomChange?.(Math.round(viewTransform.current.k * 100))
  }, [onZoomChange])

  // 진행 중인 fit/focus 애니메이션 취소 — 제스처가 애니메이션에 덮어써지지 않도록
  const cancelAnim = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  /* ── fit-to-view: 모든 노드가 뷰포트에 들어오도록 스케일/이동 ── */
  const computeFit = useCallback((): { x: number; y: number; k: number } | null => {
    const g = graphRef.current
    if (!g || g.simNodes.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of g.simNodes) {
      const r = nodeRadius(n.degree, interactive)
      if (n.x - r < minX) minX = n.x - r
      if (n.y - r < minY) minY = n.y - r
      if (n.x + r > maxX) maxX = n.x + r
      if (n.y + r > maxY) maxY = n.y + r
    }
    const { width: w, height: h } = sizeRef.current
    const pad = interactive ? 56 : 28
    const gw = Math.max(maxX - minX, 1)
    const gh = Math.max(maxY - minY, 1)
    const maxFitK = interactive ? 1.6 : 1.1
    const k = clamp(Math.min((w - pad * 2) / gw, (h - pad * 2) / gh), MIN_K, maxFitK)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    return { x: w / 2 - cx * k, y: h / 2 - cy * k, k }
  }, [interactive])

  const animateTo = useCallback(
    (target: { x: number; y: number; k: number }, duration = 400) => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (prefersReducedMotion() || duration <= 0) {
        viewTransform.current = { ...target }
        applyTransform()
        notifyZoom()
        return
      }
      const start = { ...viewTransform.current }
      const t0 = performance.now()
      const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
      const step = (now: number) => {
        const p = Math.min((now - t0) / duration, 1)
        const e = ease(p)
        viewTransform.current = {
          x: start.x + (target.x - start.x) * e,
          y: start.y + (target.y - start.y) * e,
          k: start.k + (target.k - start.k) * e,
        }
        applyTransform()
        if (p < 1) rafRef.current = requestAnimationFrame(step)
        else {
          rafRef.current = null
          notifyZoom()
        }
      }
      rafRef.current = requestAnimationFrame(step)
    },
    [applyTransform, notifyZoom]
  )

  const fit = useCallback(
    (animate = true) => {
      const target = computeFit()
      if (!target) return
      animateTo(target, animate ? 400 : 0)
    },
    [computeFit, animateTo]
  )

  /* ── 좌표 변환 ── */
  const clientToLocal = useCallback((clientX: number, clientY: number): [number, number] => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    const sx = ((clientX - rect.left) / (rect.width || 1)) * sizeRef.current.width
    const sy = ((clientY - rect.top) / (rect.height || 1)) * sizeRef.current.height
    return [sx, sy]
  }, [])

  const localToGraph = useCallback((sx: number, sy: number): [number, number] => {
    const t = viewTransform.current
    return [(sx - t.x) / t.k, (sy - t.y) / t.k]
  }, [])

  const zoomTo = useCallback(
    (newK: number, sx: number, sy: number) => {
      cancelAnim()
      const t = viewTransform.current
      const k = clamp(newK, MIN_K, MAX_K)
      const gx = (sx - t.x) / t.k
      const gy = (sy - t.y) / t.k
      t.x = sx - gx * k
      t.y = sy - gy * k
      t.k = k
      applyTransform()
      notifyZoom()
    },
    [applyTransform, notifyZoom, cancelAnim]
  )

  // 키보드 포커스 시 노드가 화면 밖이면 뷰 안으로 이동
  const ensureVisible = useCallback(
    (id: string) => {
      const sn = graphRef.current?.simNodeById.get(id)
      if (!sn) return
      const t = viewTransform.current
      const { width: w, height: h } = sizeRef.current
      const sx = sn.x * t.k + t.x
      const sy = sn.y * t.k + t.y
      const pad = 48
      if (sx < pad || sx > w - pad || sy < pad || sy > h - pad) {
        animateTo({ x: w / 2 - sn.x * t.k, y: h / 2 - sn.y * t.k, k: t.k })
      }
    },
    [animateTo]
  )

  /* ── 강조·라벨 페인트 (명령형) ── */
  const paint = useCallback(() => {
    const g = graphRef.current
    if (!g) return
    const { simNodes, simLinks, adjacency, hubSet } = g
    const { labelMode: lm, query: q, highlightGroup: hg, selectedId: sel, interactive: itv } =
      propsRef.current
    // 존재하지 않는 id(삭제·동기화로 사라진 선택/호버)를 active로 두면 전체가 흐려지므로 방어
    let active = hoveredRef.current ?? sel ?? null
    if (active != null && !g.simNodeById.has(active)) active = null
    const ql = q.trim().toLowerCase()
    const activeNeighbors = active != null ? adjacency.get(active) : undefined

    const passes = (n: SimNode) => {
      if (hg && n.group !== hg) return false
      if (ql && !(n.label.toLowerCase().includes(ql) || n.tags.some((t) => t.toLowerCase().includes(ql))))
        return false
      return true
    }

    for (const n of simNodes) {
      const grp = nodeRefs.current.get(n.id)
      if (!grp) continue
      const inHood = active == null || n.id === active || activeNeighbors?.has(n.id)
      const filteredOut = !passes(n)
      const dim = filteredOut || (active != null && !inHood)
      grp.style.opacity = dim ? '0.12' : '1'

      const circle = circleRefs.current.get(n.id)
      if (circle) {
        const isActive = active != null && n.id === active
        const isSel = sel === n.id
        circle.setAttribute('r', String(nodeRadius(n.degree, itv) * (isActive ? 1.45 : 1)))
        circle.setAttribute('fill-opacity', isActive ? '0.92' : dim ? '0.4' : '0.6')
        circle.setAttribute('stroke-width', isSel ? '2.5' : isActive ? '2' : '1.5')
      }

      const label = labelRefs.current.get(n.id)
      if (label) {
        let show = false
        if (!dim) {
          if (lm === 'all') show = true
          else if (lm === 'hubs') show = hubSet.has(n.id)
          if (active != null && (n.id === active || activeNeighbors?.has(n.id))) show = true
        }
        label.style.opacity = show ? '1' : '0'
      }
    }

    simLinks.forEach((l, i) => {
      const line = linkRefs.current[i]
      if (!line) return
      const s = l.source as SimNode
      const t = l.target as SimNode
      const eitherDim = !passes(s) || !passes(t)
      const connectsActive = active != null && (s.id === active || t.id === active)
      let op = active != null ? (connectsActive ? 0.55 : 0.05) : 0.22
      if (eitherDim) op = Math.min(op, 0.04)
      line.style.strokeOpacity = String(op)
      line.style.strokeWidth = String(
        connectsActive ? Math.min(1.4 + l.weight * 0.7, 4) : Math.min(1 + l.weight * 0.5, 3)
      )
    })
  }, [])

  /* ── 시뮬레이션 구성 — 구조(structureKey) 또는 최초 사이즈 확보 시에만 재구성 ── */
  useLayoutEffect(() => {
    if (!hasSize || !enoughNodes) return
    const { width: w, height: h } = sizeRef.current

    // 이전 레이아웃 위치를 이어받음 — 구조가 바뀌어도 기존 노드는 제자리를 유지하고
    // 데이터 변경으로 인한 전체 재배치·화면 리셋을 방지한다.
    const prevPositions = positionsRef.current
    const hadPrevLayout = prevPositions.size > 0

    const simNodes: SimNode[] = nodes.map((n) => {
      const p = prevPositions.get(n.id)
      return {
        ...n,
        x: p ? p.x : w / 2 + (Math.random() - 0.5) * w * 0.6,
        y: p ? p.y : h / 2 + (Math.random() - 0.5) * h * 0.6,
      }
    })
    const simNodeById = new Map(simNodes.map((n) => [n.id, n]))

    // 현재 노드 집합만 남기도록 위치 맵 재구성 (제거된 노드 정리)
    const nextPositions = new Map<string, { x: number; y: number }>()
    for (const n of simNodes) nextPositions.set(n.id, { x: n.x, y: n.y })
    positionsRef.current = nextPositions

    const simLinks: SimLink[] = links.map((l) => ({
      source: l.source,
      target: l.target,
      weight: l.weight,
    }))

    const adjacency = new Map<string, Set<string>>()
    for (const n of simNodes) adjacency.set(n.id, new Set())
    for (const l of links) {
      adjacency.get(l.source)?.add(l.target)
      adjacency.get(l.target)?.add(l.source)
    }
    const hubSet = new Set(simNodes.filter((n) => n.degree >= 2).map((n) => n.id))

    const renderPositions = () => {
      for (const n of simNodes) {
        const el = nodeRefs.current.get(n.id)
        if (el) el.setAttribute('transform', `translate(${n.x},${n.y})`)
        nextPositions.set(n.id, { x: n.x, y: n.y })
      }
      simLinks.forEach((l, i) => {
        const line = linkRefs.current[i]
        if (!line) return
        const s = l.source as SimNode
        const t = l.target as SimNode
        line.setAttribute('x1', String(s.x))
        line.setAttribute('y1', String(s.y))
        line.setAttribute('x2', String(t.x))
        line.setAttribute('y2', String(t.y))
      })
    }

    const simulation = forceSimulation<SimNode>(simNodes)
      .stop()
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(interactive ? 70 : 52)
          .strength((l) => clamp(l.weight * 0.25, 0.05, 0.8))
      )
      .force('charge', forceManyBody().strength(interactive ? -170 : -90).distanceMax(interactive ? 600 : 360))
      .force('x', forceX(w / 2).strength(0.07))
      .force('y', forceY(h / 2).strength(0.07))
      .force('collide', forceCollide<SimNode>().radius((d) => nodeRadius(d.degree, interactive) + (interactive ? 8 : 4)).strength(0.9))

    simulation.on('tick', renderPositions)

    // 애니메이션 없이 즉시 정착. 이전 위치를 이어받은 재구성은 반복 수를 줄여 흔들림 최소화.
    const iterations = hadPrevLayout ? 120 : 300
    for (let i = 0; i < iterations; i++) simulation.tick()
    renderPositions()

    graphRef.current = { simulation, simNodes, simLinks, simNodeById, adjacency, hubSet }

    // 최초 구성에서만 뷰를 맞춤 — 이후 데이터 변경 시 사용자의 팬/줌 보존
    if (!hadPrevLayout) fit(false)
    paint()

    return () => {
      simulation.on('tick', null)
      simulation.stop()
      graphRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureKey, hasSize, interactive])

  // prop(선택/검색/그룹/라벨) 변경 시 재페인트
  useEffect(() => {
    paint()
  }, [selectedId, query, highlightGroup, labelMode, paint])

  // 사이즈 변경 시 재-fit (시뮬레이션 재구성 없이 뷰만 갱신)
  useEffect(() => {
    if (!hasSize || !graphRef.current) return
    fit(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  /* ── 호버 강조 (이벤트 위임, 상호작용 모드에서만) ── */
  useEffect(() => {
    if (!interactive) return
    const layer = svgRef.current
    if (!layer) return
    const nodeIdFrom = (el: EventTarget | null) =>
      (el as Element | null)?.closest?.('[data-node-id]')?.getAttribute('data-node-id') ?? null
    const onOver = (e: PointerEvent) => {
      const id = nodeIdFrom(e.target)
      if (id !== hoveredRef.current) {
        hoveredRef.current = id
        paint()
      }
    }
    const onOut = (e: PointerEvent) => {
      const next = nodeIdFrom(e.relatedTarget)
      if (next !== hoveredRef.current) {
        hoveredRef.current = next
        paint()
      }
    }
    // 키보드 포커스도 호버와 동일하게 강조 + 화면 밖이면 뷰 안으로
    const onFocusIn = (e: FocusEvent) => {
      const id = nodeIdFrom(e.target)
      if (id && id !== hoveredRef.current) {
        hoveredRef.current = id
        paint()
        ensureVisible(id)
      }
    }
    const onFocusOut = (e: FocusEvent) => {
      const next = nodeIdFrom(e.relatedTarget)
      if (next !== hoveredRef.current) {
        hoveredRef.current = next
        paint()
      }
    }
    layer.addEventListener('pointerover', onOver)
    layer.addEventListener('pointerout', onOut)
    layer.addEventListener('focusin', onFocusIn)
    layer.addEventListener('focusout', onFocusOut)
    return () => {
      layer.removeEventListener('pointerover', onOver)
      layer.removeEventListener('pointerout', onOut)
      layer.removeEventListener('focusin', onFocusIn)
      layer.removeEventListener('focusout', onFocusOut)
      hoveredRef.current = null
    }
  }, [interactive, paint, ensureVisible])

  /* ── 제스처: 팬 / 노드 드래그 / 줌(휠·핀치) ── */
  const dragNode = useCallback(
    (id: string, gx: number, gy: number) => {
      const sn = graphRef.current?.simNodeById.get(id)
      if (!sn) return
      sn.fx = gx
      sn.fy = gy
    },
    []
  )
  const startNodeDrag = useCallback(() => {
    graphRef.current?.simulation.alphaTarget(0.3).restart()
  }, [])
  const endNodeDrag = useCallback((id: string) => {
    const g = graphRef.current
    if (!g) return
    const sn = g.simNodeById.get(id)
    if (sn) {
      sn.fx = null
      sn.fy = null
    }
    g.simulation.alphaTarget(0)
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

  // 키보드 조작 — 포커스된 노드에서 Enter/Space로 선택, 선택된 노드에서 재입력 시 열기
  useEffect(() => {
    if (!interactive) return
    const layer = svgRef.current
    if (!layer) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return
      const id = (e.target as Element | null)?.closest?.('[data-node-id]')?.getAttribute('data-node-id')
      if (!id) return
      e.preventDefault()
      handleTap(id)
    }
    layer.addEventListener('keydown', onKeyDown)
    return () => layer.removeEventListener('keydown', onKeyDown)
  }, [interactive, handleTap])

  interface DragMemo {
    mode: 'node' | 'pan'
    nodeId: string | null
    reheated: boolean
  }

  useGesture(
    {
      onDrag: (state) => {
        if (!propsRef.current.interactive) return
        const {
          first,
          last,
          tap,
          movement: [mx, my],
          delta: [dx, dy],
          xy: [cx, cy],
          event,
        } = state
        let memo = state.memo as DragMemo | undefined
        if (first || !memo) {
          const nodeId =
            (event.target as Element | null)?.closest?.('[data-node-id]')?.getAttribute('data-node-id') ??
            null
          memo = { mode: nodeId ? 'node' : 'pan', nodeId, reheated: false }
        }
        if (last && tap) {
          if (memo.mode === 'node' && memo.reheated) endNodeDrag(memo.nodeId!)
          handleTap(memo.nodeId)
          return memo
        }
        if (memo.mode === 'node' && memo.nodeId) {
          if (!memo.reheated && (Math.abs(mx) > 2 || Math.abs(my) > 2)) {
            startNodeDrag()
            memo.reheated = true
          }
          if (memo.reheated) {
            const [gx, gy] = localToGraph(...clientToLocal(cx, cy))
            dragNode(memo.nodeId, gx, gy)
          }
          if (last && memo.reheated) endNodeDrag(memo.nodeId)
        } else {
          // 핀치 진행 중에는 팬을 억제 — 두 손가락 확대가 뷰를 함께 끌지 않도록
          if (state.pinching) return memo
          cancelAnim()
          viewTransform.current.x += dx
          viewTransform.current.y += dy
          applyTransform()
        }
        return memo
      },
      onWheel: ({ event, delta: [, dy] }) => {
        if (!propsRef.current.interactive) return
        event.preventDefault()
        const factor = Math.exp(-dy * 0.0015)
        const [sx, sy] = clientToLocal(event.clientX, event.clientY)
        zoomTo(viewTransform.current.k * factor, sx, sy)
      },
      onPinch: ({ offset: [k], origin: [ox, oy] }) => {
        if (!propsRef.current.interactive) return
        const [sx, sy] = clientToLocal(ox, oy)
        zoomTo(k, sx, sy)
      },
    },
    {
      target: svgRef,
      enabled: interactive,
      eventOptions: { passive: false },
      drag: { filterTaps: true, pointer: { touch: true } },
      pinch: { scaleBounds: { min: MIN_K, max: MAX_K }, from: () => [viewTransform.current.k, 0] },
    }
  )

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    },
    []
  )

  useImperativeHandle(
    ref,
    (): ForceGraphHandle => ({
      zoomIn: () => zoomTo(viewTransform.current.k * 1.3, sizeRef.current.width / 2, sizeRef.current.height / 2),
      zoomOut: () => zoomTo(viewTransform.current.k / 1.3, sizeRef.current.width / 2, sizeRef.current.height / 2),
      fit,
      reset: () => {
        onSelect?.(null)
        fit(true)
      },
      focusNode: (id) => {
        const sn = graphRef.current?.simNodeById.get(id)
        if (!sn) return
        const k = clamp(1.4, MIN_K, MAX_K)
        animateTo({
          x: sizeRef.current.width / 2 - sn.x * k,
          y: sizeRef.current.height / 2 - sn.y * k,
          k,
        })
        onSelect?.(id)
      },
      exportPNG: async () => {
        const target = exportRef.current
        if (!target) return
        const isDark = document.documentElement.classList.contains('dark')
        const dataUrl = await toPng(target, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: isDark ? '#18181b' : '#ffffff',
        })
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = '지식그래프.png'
        a.click()
      },
    }),
    [zoomTo, fit, animateTo, onSelect]
  )

  return (
    <div ref={exportRef} className={className} style={{ width, height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block h-full w-full select-none"
        style={{
          touchAction: interactive ? 'none' : 'auto',
          cursor: interactive ? 'grab' : 'default',
          pointerEvents: interactive ? 'auto' : 'none',
        }}
      >
        <g ref={viewRef}>
          <GraphContent
            nodes={nodes}
            links={links}
            colorMap={colorMap}
            interactive={interactive}
            nodeRefs={nodeRefs}
            circleRefs={circleRefs}
            labelRefs={labelRefs}
            linkRefs={linkRefs}
          />
        </g>
      </svg>
    </div>
  )
})
