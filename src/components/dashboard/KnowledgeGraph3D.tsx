import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph3D, {
  type ForceGraphMethods,
  type NodeObject,
  type LinkObject,
} from 'react-force-graph-3d'
import type { GraphLink, GraphNode, LinkKind } from '@/hooks/useGraphData'

/* 지식 그래프 3D 뷰 (Three.js/WebGL — react-force-graph-3d)
   - 모달의 "3D" 토글에서만 lazy-load되는 무거운 청크. 2D(SVG)가 기본.
   - 데이터·색상·선택 상태는 2D와 동일 소스를 공유 (표현층만 교체).
   - 정밀 기능(키보드 노드 탐색·PNG 내보내기·자동 라벨)은 2D 담당 —
     3D는 조망/탐험용으로 조작을 단순하게 유지한다. */

type FGNode = NodeObject<GraphNode>
type FGLink = LinkObject<GraphNode, { weight: number; kind: LinkKind }>

interface KnowledgeGraph3DProps {
  nodes: GraphNode[]
  links: GraphLink[]
  colorMap: Map<string, string>
  width: number
  height: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  onActivate: (id: string) => void
  query: string
  highlightGroup: string | null
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 링크 끝점은 시뮬레이션 시작 후 id → 노드 객체로 치환되므로 양쪽 다 대응
const endId = (e: FGLink['source']): string =>
  typeof e === 'object' && e != null ? String(e.id) : String(e)

export default function KnowledgeGraph3D({
  nodes,
  links,
  colorMap,
  width,
  height,
  selectedId,
  onSelect,
  onActivate,
  query,
  highlightGroup,
}: KnowledgeGraph3DProps) {
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined)
  const didFitRef = useRef(false)
  // 테마는 마운트 시점 기준 (모달 안에서 테마 전환은 드묾 — 재열면 반영)
  const [isDark] = useState(() => document.documentElement.classList.contains('dark'))

  // 라이브러리가 x/y/z를 주입하며 객체를 변형하므로 복사본 전달.
  // 직전 복사본(라이브러리가 좌표를 기록해 둔 객체)에서 x/y/z/속도를 이어받아
  // 데이터 변경(AI 링크 도착·동기화·토글) 시 레이아웃 텔레포트를 방지 — 2D의 positionsRef와 동일 원리.
  const prevNodesRef = useRef<FGNode[]>([])
  const graphData = useMemo(() => {
    const prevPos = new Map(prevNodesRef.current.map((p) => [String(p.id), p]))
    const nodesCopy = nodes.map((n) => {
      const p = prevPos.get(n.id)
      return p
        ? ({ ...n, x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz } as FGNode)
        : ({ ...n } as FGNode)
    })
    prevNodesRef.current = nodesCopy
    return {
      nodes: nodesCopy,
      links: links.map((l) => ({ ...l })) as FGLink[],
    }
  }, [nodes, links])

  const adjacency = useMemo(() => {
    const adj = new Map<string, Set<string>>()
    for (const l of links) {
      if (!adj.has(l.source)) adj.set(l.source, new Set())
      if (!adj.has(l.target)) adj.set(l.target, new Set())
      adj.get(l.source)!.add(l.target)
      adj.get(l.target)!.add(l.source)
    }
    return adj
  }, [links])

  const ql = query.trim().toLowerCase()
  const neighbors = selectedId ? adjacency.get(selectedId) : undefined
  const dimColor = isDark ? '#3f3f46' : '#d4d4d8'
  const baseLink = isDark ? '#52525b' : '#a1a1aa'
  const dimLink = isDark ? '#27272a' : '#e4e4e7'

  const passes = useCallback(
    (n: FGNode) => {
      if (highlightGroup && n.group !== highlightGroup) return false
      if (ql && !n.label.toLowerCase().includes(ql)) return false
      return true
    },
    [highlightGroup, ql]
  )

  const nodeColor = useCallback(
    (n: FGNode) => {
      const inHood = !selectedId || n.id === selectedId || neighbors?.has(String(n.id))
      if (!passes(n) || !inHood) return dimColor
      return colorMap.get(n.group) || '#a1a1aa'
    },
    [selectedId, neighbors, passes, dimColor, colorMap]
  )

  const linkColor = useCallback(
    (l: FGLink) => {
      const s = endId(l.source)
      const t = endId(l.target)
      if (selectedId && (s === selectedId || t === selectedId)) {
        return isDark ? '#e4e4e7' : '#52525b' // 선택 연결 강조
      }
      if (selectedId || ql || highlightGroup) return dimLink
      return baseLink
    },
    [selectedId, ql, highlightGroup, isDark, dimLink, baseLink]
  )

  const handleNodeClick = useCallback(
    (n: FGNode) => {
      const id = String(n.id)
      if (selectedId === id) {
        onActivate(id) // 선택된 노드 재클릭 → 메모 열기 (2D와 동일)
        return
      }
      onSelect(id)
      // 클릭한 노드를 향해 카메라 이동 — 초점 전환을 몸으로 느끼게
      if (n.x != null && n.y != null && n.z != null) {
        const dist = 120
        const len = Math.hypot(n.x, n.y, n.z)
        // 원점 근처 노드(단일 노드 그래프 등)는 비율 이동이 (0,0,0) 붕괴를 일으키므로 고정 오프셋
        const target =
          len < 1e-6
            ? { x: n.x, y: n.y, z: n.z + dist }
            : { x: n.x * (1 + dist / len), y: n.y * (1 + dist / len), z: n.z * (1 + dist / len) }
        fgRef.current?.cameraPosition(target, { x: n.x, y: n.y, z: n.z }, 800)
      }
    },
    [selectedId, onSelect, onActivate]
  )

  // 최초 정착 시 1회 전체 보기
  const handleEngineStop = useCallback(() => {
    if (didFitRef.current) return
    didFitRef.current = true
    fgRef.current?.zoomToFit(600, 60)
  }, [])

  // three의 renderer.dispose()는 GL 컨텍스트를 놓지 않음(캔버스 GC 대기) —
  // 2D↔3D 토글 반복 시 살아있는 컨텍스트가 브라우저 상한(~16)까지 쌓이므로 명시 해제
  useEffect(
    () => () => {
      try {
        fgRef.current?.renderer()?.forceContextLoss()
      } catch {
        // 이미 소실된 컨텍스트 — 무시
      }
    },
    []
  )

  return (
    <ForceGraph3D<GraphNode, { weight: number; kind: LinkKind }>
      ref={fgRef}
      width={width}
      height={height}
      graphData={graphData}
      backgroundColor="rgba(0,0,0,0)"
      showNavInfo={false}
      nodeVal={(n) => 1 + n.degree * 1.5}
      nodeColor={nodeColor}
      nodeOpacity={0.85}
      nodeLabel={(n) =>
        `<div style="padding:4px 8px;border-radius:8px;font-size:12px;background:${
          isDark ? 'rgba(24,24,27,.92)' : 'rgba(255,255,255,.95)'
        };color:${isDark ? '#e4e4e7' : '#27272a'};box-shadow:0 2px 8px rgba(0,0,0,.25)">${escapeHtml(
          n.label
        )} · 연결 ${n.degree}</div>`
      }
      linkColor={linkColor}
      linkWidth={(l) => (l.kind === 'wiki' ? Math.min(0.6 + l.weight * 0.4, 2.4) : 0.5)}
      linkOpacity={0.4}
      onNodeClick={handleNodeClick}
      onBackgroundClick={() => onSelect(null)}
      onEngineStop={handleEngineStop}
      enableNodeDrag
      warmupTicks={60}
      cooldownTicks={120}
    />
  )
}
