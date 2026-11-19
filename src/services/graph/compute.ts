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
import { mergeEdges, semanticEdges, SEMANTIC_MAX, textEdges } from './edges'
import { louvain, rankCommunities } from './community'
import type { GraphLink, GraphNode, GraphRequest, GraphResult } from './types'

/* 지식 그래프 한 번 계산 — 연결 → 주제 묶음 → 레이아웃.
   워커에서 돌아 화면은 멈추지 않아요. 워커가 없는 곳(시험)에선 그대로 불러 써요. */

/** 그래프에 담는 최대 메모 수 — 넘으면 최근에 고친 메모부터 */
export const MAX_NODES = 3000

/** 노드 반지름 (그래프 좌표). 그리는 쪽과 레이아웃이 같은 값을 써요. */
export function nodeRadius(degree: number, interactive = true): number {
  const base = interactive ? 5.5 : 4
  const grow = interactive ? 2 : 1.3
  const cap = interactive ? 11 : 7
  return base + Math.min(Math.sqrt(degree) * grow, cap)
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const jitter = () => (Math.random() - 0.5) * 40

interface SimNode extends SimulationNodeDatum, GraphNode {
  x: number
  y: number
}
interface SimLink extends SimulationLinkDatum<SimNode> {
  weight: number
  kind: GraphLink['kind']
}

/** 혼자인 메모 고리 — 핵 바깥에 폴더 순서로 촘촘히 (결정적이라 다시 계산해도 같은 자리) */
const RING_GAP = 18
const RING_STEP = 16

/**
 * 이전 자리를 이어받는 힘 레이아웃.
 * 1) 이어진 메모만 힘으로 배치 — 주제 묶음마다 둥근 자리(닻)를 주어 묶음끼리 갈라 놓아요.
 * 2) 혼자인 메모는 그 핵의 크기를 잰 뒤 바로 바깥 고리에 폴더 순서로 둬요.
 *    (혼자인 메모가 힘으로 넓게 퍼지면 전체 보기가 작아져 묶음이 안 보여요)
 */
export function layout(nodes: GraphNode[], links: GraphLink[], prev: Map<string, [number, number]>): void {
  const core = nodes.filter((d) => d.degree > 0)
  const lone = nodes.filter((d) => d.degree === 0)
  const spread = Math.sqrt(Math.max(core.length, 1)) * 34

  // 주제 묶음의 닻: 큰 묶음일수록 가운데 가깝게, 황금각으로 흩어 놓아요
  const anchors = new Map<number, [number, number]>()
  const sizes = new Map<number, number>()
  for (const nd of core) if (nd.community >= 0) sizes.set(nd.community, (sizes.get(nd.community) ?? 0) + 1)
  ;[...sizes.keys()].sort((a, b) => a - b).forEach((c, i) => {
    const r = spread * 0.5 * Math.sqrt((i + 0.5) / Math.max(sizes.size, 1))
    const a = i * 2.39996
    anchors.set(c, [Math.cos(a) * r, Math.sin(a) * r])
  })

  let cx = 0
  let cy = 0
  let coreR = 0
  if (core.length) {
    let known = 0
    const simNodes: SimNode[] = core.map((nd, i) => {
      const p = prev.get(nd.id)
      if (p) {
        known++
        return Object.assign(nd, { x: p[0], y: p[1] })
      }
      const anc = anchors.get(nd.community)
      if (anc) return Object.assign(nd, { x: anc[0] + jitter(), y: anc[1] + jitter() })
      const a = i * 2.39996
      return Object.assign(nd, { x: Math.cos(a) * spread * 0.6, y: Math.sin(a) * spread * 0.6 })
    })
    const simLinks: SimLink[] = links.map((l) => ({ source: l.source, target: l.target, weight: l.weight, kind: l.kind }))
    const sim = forceSimulation<SimNode>(simNodes)
      .stop()
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          // 자동 연결(언급·태그·AI)은 느슨하게 — 명시적 링크가 구조를 주도
          .distance((l) => (l.kind === 'wiki' ? 60 : 85))
          .strength((l) => clamp(l.weight * 0.25, 0.05, 0.8) * (l.kind === 'wiki' ? 1 : l.kind === 'semantic' ? 0.5 : 0.35))
      )
      .force('charge', forceManyBody<SimNode>().strength(-100).distanceMax(500).theta(0.9))
      .force('x', forceX<SimNode>((d) => anchors.get(d.community)?.[0] ?? 0).strength((d) => (d.community >= 0 ? 0.06 : 0.03)))
      .force('y', forceY<SimNode>((d) => anchors.get(d.community)?.[1] ?? 0).strength((d) => (d.community >= 0 ? 0.06 : 0.03)))
      .force('collide', forceCollide<SimNode>().radius((d) => nodeRadius(d.degree) + 7).strength(0.9).iterations(1))

    // 대부분 자리를 이어받으면 짧게 다듬기만, 처음이면 충분히 — 큰 그래프는 조금 줄여요
    const n = core.length
    const fresh = known < n * 0.6
    const base = fresh ? 320 : 90
    const iterations = Math.round(base * (n > 1500 ? 0.5 : n > 600 ? 0.75 : 1))
    if (!fresh) sim.alpha(0.35)
    for (let i = 0; i < iterations; i++) sim.tick()
    for (const nd of simNodes) {
      nd.x = Math.round(nd.x * 10) / 10
      nd.y = Math.round(nd.y * 10) / 10
      delete nd.vx
      delete nd.vy
      delete nd.index
      cx += nd.x
      cy += nd.y
    }
    cx /= n
    cy /= n
    // 핵의 반지름 — 맨 바깥 2%는 빼고 재요 (멀리 튄 한두 개에 고리가 끌려가지 않게)
    const dists = simNodes.map((d) => Math.hypot(d.x - cx, d.y - cy) + nodeRadius(d.degree)).sort((a, b) => a - b)
    coreR = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.98))]
  }

  // 혼자인 메모: 폴더 → 제목 순으로 고리에 차례로
  lone.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
  let r = coreR + (core.length ? RING_GAP + 8 : 0)
  let i = 0
  while (i < lone.length) {
    const cap = Math.max(1, Math.floor((2 * Math.PI * Math.max(r, RING_STEP)) / RING_STEP))
    const count = Math.min(cap, lone.length - i)
    for (let j = 0; j < count; j++) {
      const a = (j / count) * Math.PI * 2 - Math.PI / 2
      const nd = lone[i + j]
      nd.x = Math.round((cx + Math.cos(a) * r) * 10) / 10
      nd.y = Math.round((cy + Math.sin(a) * r) * 10) / 10
    }
    i += count
    r += RING_GAP
  }
}

export function computeGraph(req: GraphRequest): GraphResult {
  const t0 = performance.now()
  const total = req.memos.length
  const truncated = total > MAX_NODES
  const memos = truncated
    ? [...req.memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, MAX_NODES)
    : req.memos

  const ids = new Set(memos.map((m) => m.id))
  const text = textEdges(memos)

  // 의미 연결 — 그래프에 있는 메모 중 최근 SEMANTIC_MAX개
  const recent = memos.length > SEMANTIC_MAX
    ? new Set([...memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, SEMANTIC_MAX).map((m) => m.id))
    : ids
  const vecs = req.vectors.filter(([id]) => recent.has(id))
  const links = mergeEdges(text, semanticEdges(vecs))

  const degree = new Map<string, number>()
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) ?? 0) + 1)
    degree.set(l.target, (degree.get(l.target) ?? 0) + 1)
  }

  const order = memos.map((m) => m.id)
  const raw = louvain(order, links)
  const { community, communities } = rankCommunities(raw, memos.map((m) => m.title))

  const nodes: GraphNode[] = memos.map((m, i) => ({
    id: m.id,
    label: m.title.trim() || '제목 없음',
    group: m.group,
    community: community[i],
    degree: degree.get(m.id) ?? 0,
    x: 0,
    y: 0,
  }))

  layout(nodes, links, new Map(req.prev.map(([id, x, y]) => [id, [x, y]])))

  const freq = new Map<string, number>()
  for (const nd of nodes) freq.set(nd.group, (freq.get(nd.group) ?? 0) + 1)
  const groups = [...freq.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0])

  return { nodes, links, groups, communities, total, truncated, ms: Math.round(performance.now() - t0) }
}
