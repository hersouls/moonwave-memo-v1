import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import ForceGraph3D, { type ForceGraphMethods, type LinkObject, type NodeObject } from 'react-force-graph-3d'
import * as THREE from 'three'
import type { GraphLink, GraphNode, LinkKind } from '@/services/graph/types'
import { nodeSize3D } from '@/services/graph/layout3d'
import { resolveCssColor } from '@/utils/cssColor'
import { useTheme } from '@/mw/theme'
import { useReducedMotion } from '@/mw/gestures'
import type { LabelMode } from './ForceGraph'

/* 지식 그래프 3D 보기 (Three.js/WebGL — react-force-graph-3d)
   - 자리는 워커가 계산해 와요(주제 묶음이 공간에서 덩어리로 갈라져요). 여기서는 시뮬레이션 없이 그리기만 해요.
   - 주제 묶음마다 은은한 빛무리와 이름을 띄워 공간에서도 길을 잃지 않게 해요.
   - 큰 메모의 이름은 화면 크기 그대로(거리와 상관없이) 보여요.
   - 메모를 고르면 카메라가 날아가고, 이어진 연결이 밝아지며 그 위로 빛 입자가 흘러요(움직임 줄이기면 바로 · 입자 없음).
   - 깊이 안개로 앞뒤가 읽혀요.
   - 키보드로 옮겨 다니기는 2D 보기에서 해요. 여기는 둘러보기용이에요. */

type FGNode = NodeObject<GraphNode>
type FGLink = LinkObject<GraphNode, { weight: number; kind: LinkKind; sim?: number }>

export interface KnowledgeGraph3DHandle {
  zoomIn(): void
  zoomOut(): void
  fit(): void
  focusNode(id: string): void
  exportPNG(): Promise<void>
}

export interface Topic3D {
  /** 색 기준 키 (t0, t1 …) — 노드의 group과 같아요 */
  key: string
  label: string
}

interface KnowledgeGraph3DProps {
  /** group = 색 기준 키 */
  nodes: GraphNode[]
  links: GraphLink[]
  /** 색 기준 키 → 색 */
  colorMap: Map<string, string>
  /** 워커가 계산한 3D 자리 */
  positions: Map<string, [number, number, number]>
  width: number
  height: number
  selectedId: string | null
  onSelect: (id: string | null) => void
  onActivate: (id: string) => void
  query: string
  /** 범례에서 고른 색 기준 키 */
  highlightGroup: string | null
  labelMode: LabelMode
  /** 주제 색일 때 묶음 빛무리 · 이름 */
  topics: Topic3D[] | null
}

const AUTO_LABELS = 8
const ALL_LABELS = 300
const LABEL_PX = 12
const TOPIC_PX = 14
const FLY_MS = 900

/** rgb(…)에 투명도를 입혀요 — 흐린 노드 · 연결은 거의 투명하게 (react-force-graph가 알파를 재질 투명도로 써요) */
function withAlpha(rgb: string, a: number): string {
  const m = rgb.match(/[\d.]+/g)
  return m && m.length >= 3 ? `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})` : rgb
}

const endId = (e: FGLink['source']): string => (typeof e === 'object' && e != null ? String(e.id) : String(e))
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/* ── 글자 스프라이트 (캐시해 두고 테마가 바뀔 때만 새로) ── */
interface TextSpriteOpts {
  px: number
  weight: number
  color: string
  halo: string
  /** 노드 오른쪽에 붙일지(라벨) · 가운데 위(주제 이름) */
  anchor: 'right' | 'above'
}
function makeTextSprite(text: string, font: string, o: TextSpriteOpts): THREE.Sprite {
  const scale = 2 // 선명하게
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `${o.weight} ${o.px * scale}px ${font}`
  const w = Math.ceil(ctx.measureText(text).width) + 8 * scale
  const h = Math.ceil(o.px * 1.5 * scale)
  canvas.width = w
  canvas.height = h
  ctx.font = `${o.weight} ${o.px * scale}px ${font}`
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 4 * scale
  ctx.strokeStyle = o.halo
  ctx.strokeText(text, 4 * scale, h / 2)
  ctx.fillStyle = o.color
  ctx.fillText(text, 4 * scale, h / 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, sizeAttenuation: false, fog: false })
  const sprite = new THREE.Sprite(mat)
  sprite.renderOrder = 10
  sprite.userData = { pw: w / scale, ph: h / scale }
  if (o.anchor === 'right') sprite.center.set(-0.06, 0.5)
  else sprite.center.set(0.5, 0)
  return sprite
}
/** 화면 크기 그대로 보이게 — sizeAttenuation=false에서 1 = 시야 높이의 2·tan(fov/2) 배 */
function sizeSprite(s: THREE.Sprite, viewH: number, fov: number) {
  const k = (2 * Math.tan(THREE.MathUtils.degToRad(fov / 2))) / Math.max(viewH, 1)
  s.scale.set(s.userData.pw * k, s.userData.ph * k, 1)
}
function disposeSprite(s: THREE.Object3D) {
  if (s instanceof THREE.Sprite) {
    s.material.map?.dispose()
    s.material.dispose()
  }
}

/** 둥근 빛무리 텍스처 (흰색 → 투명). 색은 재질 color로 입혀요 */
let glowTex: THREE.Texture | null = null
function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  // 흰 가림막 — 색은 재질이 입혀요
  const white = resolveCssColor('var(--static-white)')
  grd.addColorStop(0, withAlpha(white, 1))
  grd.addColorStop(0.45, withAlpha(white, 0.35))
  grd.addColorStop(1, withAlpha(white, 0))
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  glowTex = new THREE.CanvasTexture(c)
  return glowTex
}

const KnowledgeGraph3D = forwardRef<KnowledgeGraph3DHandle, KnowledgeGraph3DProps>(function KnowledgeGraph3D(
  { nodes, links, colorMap, positions, width, height, selectedId, onSelect, onActivate, query, highlightGroup, labelMode, topics },
  ref
) {
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined)
  const { dark } = useTheme()
  const reduced = useReducedMotion()
  const [hoverId, setHoverId] = useState<string | null>(null)
  const fittedRef = useRef(false)

  /* ── 색 (테마마다 한 번) ── */
  const colors = useMemo(() => {
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif'
    return {
      bg: resolveCssColor('var(--background-secondary)'),
      link: resolveCssColor('var(--text-tertiary)'),
      linkStrong: resolveCssColor('var(--text-primary)'),
      label: resolveCssColor('var(--text-primary)'),
      halo: resolveCssColor('var(--background-secondary)'),
      other: resolveCssColor('var(--mw-cat-other)'),
      font,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark])
  const keyColor = useMemo(() => {
    const m = new Map<string, string>()
    for (const [k, v] of colorMap) m.set(k, resolveCssColor(v, colors.other))
    return m
  }, [colorMap, colors])

  /* ── 데이터: 워커 자리에 고정 (시뮬레이션 없음) ── */
  const graphData = useMemo(() => {
    const ns: FGNode[] = []
    for (const n of nodes) {
      const p = positions.get(n.id)
      if (!p) continue
      ns.push({ ...n, x: p[0], y: p[1], z: p[2], fx: p[0], fy: p[1], fz: p[2] } as FGNode)
    }
    const ids = new Set(ns.map((n) => n.id))
    const ls = links.filter((l) => ids.has(l.source) && ids.has(l.target)).map((l) => ({ ...l })) as FGLink[]
    return { nodes: ns, links: ls }
  }, [nodes, links, positions])

  const { adjacency, center, radius, fitRadius } = useMemo(() => {
    const adj = new Map<string, Set<string>>()
    for (const l of links) {
      ;(adj.get(l.source) ?? adj.set(l.source, new Set()).get(l.source)!).add(l.target)
      ;(adj.get(l.target) ?? adj.set(l.target, new Set()).get(l.target)!).add(l.source)
    }
    let cx = 0, cy = 0, cz = 0
    const ns = graphData.nodes
    for (const n of ns) {
      cx += n.x!
      cy += n.y!
      cz += n.z!
    }
    const k = Math.max(ns.length, 1)
    const c = { x: cx / k, y: cy / k, z: cz / k }
    let r = 1
    for (const n of ns) r = Math.max(r, Math.hypot(n.x! - c.x, n.y! - c.y, n.z! - c.z))
    // 전체 보기는 이어진 메모(핵)에 맞춰요 — 혼자인 메모 껍질까지 담으면 묶음이 작아져요
    const core = ns.filter((n) => n.degree > 0).map((n) => Math.hypot(n.x! - c.x, n.y! - c.y, n.z! - c.z)).sort((a, b) => a - b)
    const coreR = core.length >= 3 ? core[Math.floor(core.length * 0.95)] * 1.12 : r
    return { adjacency: adj, center: c, radius: r, fitRadius: Math.max(coreR, 30) }
  }, [links, graphData])

  const active = hoverId ?? selectedId
  const hood = active ? adjacency.get(active) : undefined
  const ql = query.trim().toLowerCase()
  const passes = useCallback(
    (n: FGNode) => (!highlightGroup || n.group === highlightGroup) && (!ql || n.label.toLowerCase().includes(ql)),
    [highlightGroup, ql]
  )
  const inHood = useCallback((id: string) => !active || id === active || !!hood?.has(id), [active, hood])
  // 이름표는 가리킬 때가 아니라 고를 때만 바뀌어요 — 이름표 함수가 바뀌면 노드 물체를 모두 다시 만들어서요
  const selHood = selectedId ? adjacency.get(selectedId) : undefined
  const inSelHood = useCallback((id: string) => !selectedId || id === selectedId || !!selHood?.has(id), [selectedId, selHood])

  const nodeColor = useCallback(
    (n: FGNode) => {
      const c = keyColor.get(n.group) ?? colors.other
      return passes(n) && inHood(String(n.id)) ? c : withAlpha(c, n.degree === 0 ? 0.05 : 0.1)
    },
    [passes, inHood, keyColor, colors]
  )
  const touchesSel = useCallback(
    (l: FGLink) => !!selectedId && (endId(l.source) === selectedId || endId(l.target) === selectedId),
    [selectedId]
  )
  const touchesActive = useCallback(
    (l: FGLink) => !!active && (endId(l.source) === active || endId(l.target) === active),
    [active]
  )
  const linkColor = useCallback(
    (l: FGLink) => (touchesActive(l) ? colors.linkStrong : active || ql || highlightGroup ? withAlpha(colors.link, 0.12) : colors.link),
    [touchesActive, active, ql, highlightGroup, colors]
  )

  /* ── 이름표: 큰 메모 + 고른 메모와 이웃 ── */
  const labeled = useMemo(() => {
    const set = new Set<string>()
    if (labelMode !== 'none') {
      const limit = labelMode === 'all' ? ALL_LABELS : AUTO_LABELS
      ;[...graphData.nodes]
        .filter((n) => n.degree > 0 || labelMode === 'all')
        .sort((a, b) => b.degree - a.degree)
        .slice(0, limit)
        .forEach((n) => set.add(String(n.id)))
    }
    if (selectedId) {
      set.add(selectedId)
      adjacency.get(selectedId)?.forEach((id) => set.add(id))
    }
    return set
  }, [labelMode, graphData.nodes, selectedId, adjacency])

  const spriteCache = useRef(new Map<string, THREE.Sprite>())
  useEffect(() => {
    // 테마가 바뀌면 글자 색이 바뀌니 새로 만들어요
    const cache = spriteCache.current
    return () => {
      cache.forEach(disposeSprite)
      cache.clear()
    }
  }, [colors])

  const fov = () => (fgRef.current?.camera() as THREE.PerspectiveCamera | undefined)?.fov ?? 40
  const nodeThreeObject = useCallback(
    (n: FGNode) => {
      const id = String(n.id)
      if (!labeled.has(id)) return null as unknown as THREE.Object3D
      const text = n.label.length > 20 ? n.label.slice(0, 20) + '…' : n.label
      const key = `${id}|${text}`
      let s = spriteCache.current.get(key)
      if (!s) {
        s = makeTextSprite(text, colors.font, { px: LABEL_PX, weight: 500, color: colors.label, halo: colors.halo, anchor: 'right' })
        spriteCache.current.set(key, s)
      }
      sizeSprite(s, height, fov())
      // 고른 메모의 이웃이 아니거나 걸러진 메모의 이름은 숨겨요 (흐린 글씨도 어지러워요).
      // 보일 자격과 우선순위만 적고, 실제로 보일지는 겹침 정리(declutter)가 정해요
      s.userData.eligible = passes(n) && inSelHood(id)
      s.userData.priority = id === selectedId ? 1e9 : selHood?.has(id) ? 1e5 + n.degree : n.degree
      s.visible = s.userData.eligible
      scheduleDeclutter()
      return s
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labeled, colors, height, passes, inSelHood]
  )

  /* ── 주제 묶음 빛무리 · 이름 ── */
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const scene = fg.scene()
    const group = new THREE.Group()
    group.name = 'kg-topics'
    if (topics?.length) {
      const byKey = new Map<string, FGNode[]>()
      for (const n of graphData.nodes) {
        if (n.degree === 0) continue
        const arr = byKey.get(n.group)
        if (arr) arr.push(n)
        else byKey.set(n.group, [n])
      }
      for (const t of topics) {
        const ms = byKey.get(t.key)
        if (!ms || ms.length < 3) continue
        let x = 0, y = 0, z = 0
        for (const n of ms) {
          x += n.x!
          y += n.y!
          z += n.z!
        }
        x /= ms.length
        y /= ms.length
        z /= ms.length
        const d = ms.map((n) => Math.hypot(n.x! - x, n.y! - y, n.z! - z)).sort((a, b) => a - b)
        const r = d[Math.floor(d.length * 0.8)] + 12
        const dimmed = !!highlightGroup && highlightGroup !== t.key
        const glow = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTexture(),
            color: new THREE.Color(keyColor.get(t.key) ?? colors.other),
            transparent: true,
            opacity: dimmed ? 0.03 : dark ? 0.22 : 0.16,
            depthWrite: false,
            blending: dark ? THREE.AdditiveBlending : THREE.NormalBlending,
          })
        )
        glow.position.set(x, y, z)
        glow.scale.set(r * 2.6, r * 2.6, 1)
        group.add(glow)
        const name = makeTextSprite(t.label, colors.font, { px: TOPIC_PX, weight: 700, color: colors.label, halo: colors.halo, anchor: 'above' })
        name.material.opacity = dimmed ? 0.25 : 0.95
        name.userData.eligible = true
        name.userData.priority = 1e6 + ms.length
        sizeSprite(name, height, fov())
        name.position.set(x, y + r * 0.95, z)
        group.add(name)
      }
    }
    scene.add(group)
    scheduleDeclutter()
    return () => {
      scene.remove(group)
      group.children.forEach((c) => {
        if (c instanceof THREE.Sprite && c.material.map !== glowTex) disposeSprite(c)
        else if (c instanceof THREE.Sprite) c.material.dispose()
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, graphData, keyColor, colors, dark, height, highlightGroup])

  /* ── 이름표 겹침 정리: 카메라가 움직일 때마다 화면에 투영해 겹치는 것을 우선순위대로 숨겨요 ── */
  const declutterRaf = useRef<number | null>(null)
  const declutter = useCallback(() => {
    declutterRaf.current = null
    const fg = fgRef.current
    if (!fg) return
    const cam = fg.camera()
    const items: Array<{ s: THREE.Sprite; pri: number }> = []
    fg.scene().traverse((o) => {
      if (o instanceof THREE.Sprite && o.userData.eligible !== undefined && o.parent) items.push({ s: o, pri: o.userData.priority ?? 0 })
    })
    items.sort((a, b) => b.pri - a.pri)
    const boxes: Array<[number, number, number, number]> = []
    const v = new THREE.Vector3()
    for (const { s } of items) {
      if (!s.userData.eligible) {
        s.visible = false
        continue
      }
      s.getWorldPosition(v)
      v.project(cam)
      if (v.z > 1) {
        s.visible = false // 카메라 뒤
        continue
      }
      const x = (v.x * 0.5 + 0.5) * width
      const y = (-v.y * 0.5 + 0.5) * height
      const w = s.userData.pw as number
      const h = s.userData.ph as number
      const left = x - s.center.x * w
      const top = y - (1 - s.center.y) * h
      const box: [number, number, number, number] = [left, top, left + w, top + h]
      const hit = boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])
      s.visible = !hit
      if (!hit) boxes.push(box)
    }
  }, [width, height])
  const declutterRef = useRef(declutter)
  declutterRef.current = declutter
  function scheduleDeclutter() {
    if (declutterRaf.current !== null) return
    declutterRaf.current = requestAnimationFrame(() => declutterRef.current())
  }
  useEffect(() => {
    const controls = fgRef.current?.controls() as { addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void } | undefined
    if (!controls?.addEventListener) return
    const on = () => scheduleDeclutter()
    controls.addEventListener('change', on)
    return () => {
      controls.removeEventListener?.('change', on)
      if (declutterRaf.current !== null) cancelAnimationFrame(declutterRaf.current)
      declutterRaf.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData])

  /* ── 장면: 배경 · 안개 · 조작 ── */
  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const scene = fg.scene()
    scene.fog = new THREE.Fog(colors.bg, radius * 1.4, radius * 5.5)
    const controls = fg.controls() as { enableDamping?: boolean; dampingFactor?: number }
    controls.enableDamping = !reduced
    controls.dampingFactor = 0.08
  }, [colors, radius, reduced])

  /* ── 카메라 ── */
  /** 경계 구가 화면 높이에 꽉 차게 — 지금 바라보는 방향은 그대로 */
  const fit = useCallback(
    (ms = FLY_MS) => {
      const fg = fgRef.current
      if (!fg) return
      const cam = fg.camera() as THREE.PerspectiveCamera
      const half = THREE.MathUtils.degToRad(cam.fov / 2)
      const aspect = width / Math.max(height, 1)
      const halfW = Math.atan(Math.tan(half) * aspect)
      // 구는 투영하면 가장자리가 비어 보여서 조금 더 다가가요
      const dist = (fitRadius / Math.sin(Math.min(half, halfW))) * 0.82
      const dir = new THREE.Vector3(cam.position.x - center.x, cam.position.y - center.y, cam.position.z - center.z)
      if (dir.lengthSq() < 1e-6) dir.set(0, 0.25, 1)
      dir.normalize().multiplyScalar(dist)
      fg.cameraPosition({ x: center.x + dir.x, y: center.y + dir.y, z: center.z + dir.z }, center, reduced ? 0 : ms)
      setTimeout(() => declutterRef.current(), (reduced ? 0 : ms) + 60)
    },
    [reduced, fitRadius, center, width, height]
  )

  const flyTo = useCallback(
    (id: string) => {
      const n = graphData.nodes.find((d) => String(d.id) === id)
      const fg = fgRef.current
      if (!n || !fg) return
      // 그래프 가운데에서 그 메모 쪽으로, 조금 바깥에서 바라봐요
      const dx = n.x! - center.x
      const dy = n.y! - center.y
      const dz = n.z! - center.z
      const len = Math.hypot(dx, dy, dz)
      const dist = Math.max(70, radius * 0.45)
      const dir = len < 1e-6 ? { x: 0, y: 0, z: 1 } : { x: dx / len, y: dy / len, z: dz / len }
      fg.cameraPosition(
        { x: n.x! + dir.x * dist, y: n.y! + dir.y * dist + dist * 0.15, z: n.z! + dir.z * dist },
        { x: n.x!, y: n.y!, z: n.z! },
        reduced ? 0 : FLY_MS
      )
      setTimeout(() => declutterRef.current(), (reduced ? 0 : FLY_MS) + 60)
    },
    [graphData.nodes, center, radius, reduced]
  )

  // 처음 그릴 때 한 번 전체 보기 (멀리서 다가오듯)
  useEffect(() => {
    if (fittedRef.current || !graphData.nodes.length) return
    const t = setTimeout(() => {
      fittedRef.current = true
      fit(1200)
    }, 60)
    return () => clearTimeout(t)
  }, [graphData.nodes.length, fit])

  // 고르면 그쪽으로 날아가요
  const lastFlown = useRef<string | null>(null)
  useEffect(() => {
    if (!selectedId) {
      lastFlown.current = null
      return
    }
    if (lastFlown.current === selectedId) return
    lastFlown.current = selectedId
    flyTo(selectedId)
  }, [selectedId, flyTo])

  const dolly = useCallback(
    (factor: number) => {
      const fg = fgRef.current
      if (!fg) return
      const cam = fg.camera()
      const target = (fg.controls() as { target?: THREE.Vector3 }).target ?? new THREE.Vector3(center.x, center.y, center.z)
      const p = cam.position.clone().sub(target).multiplyScalar(factor).add(target)
      fg.cameraPosition({ x: p.x, y: p.y, z: p.z }, { x: target.x, y: target.y, z: target.z }, reduced ? 0 : 300)
      setTimeout(() => declutterRef.current(), (reduced ? 0 : 300) + 60)
    },
    [center, reduced]
  )

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => dolly(0.75),
      zoomOut: () => dolly(1 / 0.75),
      fit: () => fit(),
      focusNode: (id: string) => {
        lastFlown.current = id
        flyTo(id)
        onSelect(id)
      },
      exportPNG: async () => {
        const canvas = fgRef.current?.renderer().domElement as HTMLCanvasElement | undefined
        if (!canvas) throw new Error('canvas')
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
        if (!blob) throw new Error('blob')
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = '지식그래프-3D.png'
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      },
    }),
    [dolly, fit, flyTo, onSelect]
  )

  const handleNodeClick = useCallback(
    (n: FGNode) => {
      const id = String(n.id)
      if (selectedId === id) onActivate(id) // 고른 메모를 한 번 더 → 열기 (2D와 같아요)
      else onSelect(id)
    },
    [selectedId, onSelect, onActivate]
  )

  // GL 컨텍스트를 바로 놓아요 — 2D↔3D를 오가도 브라우저 상한(~16)까지 쌓이지 않게
  useEffect(() => {
    const cache = spriteCache.current
    return () => {
      cache.forEach(disposeSprite)
      cache.clear()
      try {
        fgRef.current?.renderer()?.forceContextLoss()
      } catch {
        // 이미 놓았어요
      }
    }
  }, [])

  const particleColor = selectedId ? graphData.nodes.find((n) => String(n.id) === selectedId) : undefined

  return (
    <div
      role="img"
      aria-label={`지식 그래프 3D 보기 — 메모 ${graphData.nodes.length}개, 연결 ${graphData.links.length}개. 키보드로 옮겨 다니려면 2D 보기를 써요`}
      style={{ width, height, cursor: hoverId ? 'pointer' : 'grab' }}
    >
      <ForceGraph3D<GraphNode, { weight: number; kind: LinkKind; sim?: number }>
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        backgroundColor={colors.bg}
        showNavInfo={false}
        controlType="orbit"
        rendererConfig={{ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        warmupTicks={0}
        cooldownTicks={0}
        enableNodeDrag={false}
        nodeRelSize={1}
        nodeVal={(n) => Math.pow(nodeSize3D(n.degree), 3)}
        nodeResolution={12}
        nodeColor={nodeColor}
        nodeOpacity={0.92}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend
        nodeLabel={(n) => `<div class="memo-graph-tip">${escapeHtml(n.label)} · 연결 ${n.degree}</div>`}
        linkColor={linkColor}
        linkWidth={(l) => (touchesSel(l) ? 1.1 : 0)}
        linkOpacity={0.42}
        linkDirectionalParticles={(l) => (!reduced && touchesSel(l) ? 3 : 0)}
        linkDirectionalParticleSpeed={0.006}
        linkDirectionalParticleWidth={1.6}
        linkDirectionalParticleColor={() => (particleColor ? keyColor.get(particleColor.group) ?? colors.label : colors.label)}
        onNodeClick={handleNodeClick}
        onNodeHover={(n) => setHoverId(n ? String(n.id) : null)}
        onBackgroundClick={() => onSelect(null)}
      />
    </div>
  )
})

export default KnowledgeGraph3D
