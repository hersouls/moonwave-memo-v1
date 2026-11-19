import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  forceZ,
} from 'd3-force-3d'
import type { LinkKind } from './types'

/* 지식 그래프 3D 배치 — 워커에서 계산해 화면은 고정된 자리를 그리기만 해요.
   2D와 같은 생각: 이어진 메모(핵)는 주제 묶음마다 공간의 닻을 주어 덩어리로 가르고,
   혼자인 메모는 핵을 잰 뒤 바깥 껍질(피보나치 구면)에 폴더 순서로 고르게 둬요. */

export interface Layout3DRequest {
  type: 'layout3d'
  seq: number
  /** [id, 연결 수, 주제 묶음, 폴더] */
  nodes: Array<[string, number, number, string]>
  /** [source, target, 종류, 가중치] */
  links: Array<[string, string, LinkKind, number]>
  /** 직전 3D 자리 [id, x, y, z] */
  prev: Array<[string, number, number, number]>
}

export interface Layout3DResponse {
  type: 'layout3d'
  seq: number
  ids: string[]
  /** ids 순서대로 x, y, z */
  pos: Float32Array
  ms: number
}

interface N3 {
  id: string
  degree: number
  community: number
  group: string
  x?: number
  y?: number
  z?: number
  vx?: number
  vy?: number
  vz?: number
}
interface L3 {
  source: string | N3
  target: string | N3
  kind: LinkKind
  weight: number
}

const GOLDEN = Math.PI * (3 - Math.sqrt(5))
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const jitter = () => (Math.random() - 0.5) * 30

/** 구면 위 i/n번째 방향 (고르게 퍼진 피보나치 점) */
function fib(i: number, n: number): [number, number, number] {
  const y = n <= 1 ? 0 : 1 - (i / (n - 1)) * 2
  const r = Math.sqrt(Math.max(0, 1 - y * y))
  const t = i * GOLDEN
  return [Math.cos(t) * r, y, Math.sin(t) * r]
}

/** 3D 노드 크기 (반지름) — 그리는 쪽과 같은 값 */
export function nodeSize3D(degree: number): number {
  return 2.2 + Math.min(Math.sqrt(degree) * 0.9, 5)
}

export function layout3D(req: Layout3DRequest): Layout3DResponse {
  const t0 = performance.now()
  const prev = new Map(req.prev.map(([id, x, y, z]) => [id, [x, y, z] as const]))
  const all: N3[] = req.nodes.map(([id, degree, community, group]) => ({ id, degree, community, group }))
  const core = all.filter((n) => n.degree > 0)
  const lone = all.filter((n) => n.degree === 0)
  const spread = Math.cbrt(Math.max(core.length, 1)) * 42

  // 주제 묶음의 닻: 큰 묶음일수록 가운데, 방향은 구면에 고르게
  const sizes = new Map<number, number>()
  for (const n of core) if (n.community >= 0) sizes.set(n.community, (sizes.get(n.community) ?? 0) + 1)
  const ks = [...sizes.keys()].sort((a, b) => a - b)
  const anchors = new Map<number, [number, number, number]>()
  ks.forEach((c, i) => {
    const r = spread * 1.05 * Math.cbrt((i + 0.5) / Math.max(ks.length, 1))
    const [dx, dy, dz] = fib(i, Math.max(ks.length, 2))
    anchors.set(c, [dx * r, dy * r, dz * r])
  })

  let cx = 0
  let cy = 0
  let cz = 0
  let coreR = 0
  if (core.length) {
    let known = 0
    core.forEach((n, i) => {
      const p = prev.get(n.id)
      if (p) {
        known++
        ;[n.x, n.y, n.z] = p
        return
      }
      const a = anchors.get(n.community)
      if (a) {
        n.x = a[0] + jitter()
        n.y = a[1] + jitter()
        n.z = a[2] + jitter()
      } else {
        const [dx, dy, dz] = fib(i, core.length)
        n.x = dx * spread * 0.7
        n.y = dy * spread * 0.7
        n.z = dz * spread * 0.7
      }
    })
    const ids = new Set(core.map((n) => n.id))
    const links: L3[] = req.links
      .filter(([s, t]) => ids.has(s) && ids.has(t))
      .map(([source, target, kind, weight]) => ({ source, target, kind, weight }))
    const pull = (d: N3) => (d.community >= 0 ? 0.09 : 0.03)
    const sim = forceSimulation<N3>(core, 3)
      .stop()
      .force(
        'link',
        forceLink<N3, L3>(links)
          .id((d) => d.id)
          .distance((l) => (l.kind === 'wiki' ? 34 : 48))
          .strength((l) => clamp(l.weight * 0.25, 0.05, 0.8) * (l.kind === 'wiki' ? 1 : l.kind === 'semantic' ? 0.5 : 0.35))
      )
      .force('charge', forceManyBody<N3>().strength(-55).distanceMax(400).theta(0.9))
      .force('x', forceX<N3>((d) => anchors.get(d.community)?.[0] ?? 0).strength(pull))
      .force('y', forceY<N3>((d) => anchors.get(d.community)?.[1] ?? 0).strength(pull))
      .force('z', forceZ<N3>((d) => anchors.get(d.community)?.[2] ?? 0).strength(pull))
      .force('collide', forceCollide<N3>((d) => nodeSize3D(d.degree) + 3).strength(0.8).iterations(1))
    const n = core.length
    const fresh = known < n * 0.6
    if (!fresh) sim.alpha(0.3)
    const iterations = Math.round((fresh ? 260 : 80) * (n > 1500 ? 0.5 : n > 600 ? 0.75 : 1))
    sim.tick(iterations)
    for (const d of core) {
      cx += d.x!
      cy += d.y!
      cz += d.z!
    }
    cx /= n
    cy /= n
    cz /= n
    const dists = core.map((d) => Math.hypot(d.x! - cx, d.y! - cy, d.z! - cz)).sort((a, b) => a - b)
    coreR = dists[Math.min(dists.length - 1, Math.floor(dists.length * 0.98))] + 8
  }

  // 혼자인 메모: 폴더 순서로 바깥 껍질에, 껍질이 차면 한 겹 더
  lone.sort((a, b) => a.group.localeCompare(b.group) || a.id.localeCompare(b.id))
  const STEP = 11
  let r = core.length ? coreR + 22 : 20
  let i = 0
  while (i < lone.length) {
    const cap = Math.max(1, Math.floor((4 * Math.PI * r * r) / (STEP * STEP)))
    const count = Math.min(cap, lone.length - i)
    for (let j = 0; j < count; j++) {
      const [dx, dy, dz] = fib(j, count)
      const d = lone[i + j]
      d.x = cx + dx * r
      d.y = cy + dy * r
      d.z = cz + dz * r
    }
    i += count
    r += STEP * 1.6
  }

  const pos = new Float32Array(all.length * 3)
  all.forEach((d, k) => {
    pos[k * 3] = d.x ?? 0
    pos[k * 3 + 1] = d.y ?? 0
    pos[k * 3 + 2] = d.z ?? 0
  })
  return { type: 'layout3d', seq: req.seq, ids: all.map((d) => d.id), pos, ms: Math.round(performance.now() - t0) }
}
