import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { DialogTitle } from '@headlessui/react'
import { Dialog } from '@/components/ui/Dialog'
import { useToastStore } from '@/stores/toastStore'
import { rememberPositions, setSemanticWanted, useKnowledgeGraph } from '@/services/graph/graphEngine'
import { KIND_ORDER, type GraphLink, type GraphNode, type GraphResult, type LinkKind } from '@/services/graph/types'
import { ForceGraph, type ForceGraphHandle, type LabelMode } from './ForceGraph'
import { GROUP_COLORS, NONE_COLOR } from './graphColors'
import { IcLineClose, IcLineDownload, IcLineExpand, IcLineExternalLink, IcLineEye, IcLineEyeHidden, IcLineFolder, IcLineLoading, IcLineSearch, IcLineShare, IcMwRotate, IcMwSparkles, IcMwTag, IcMwZoomIn, IcMwZoomOut } from '@/mw/icons'

// 3D 보기(Three.js) — 켤 때만 내려받는 지연 청크. 로드 실패는 영구 캐시되므로 다시 시도할 땐 새로 만들어요.
const make3DLazy = () => lazy(() => import('./KnowledgeGraph3D'))

// 청크 로드 실패(오프라인 · 배포 교체)가 대시보드 전체 오류로 번지지 않게 막아요
class Graph3DBoundary extends Component<{ onRetry: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
          <p>3D 보기를 불러오지 못했어요. 인터넷 연결이나 앱 업데이트를 확인해 주세요.</p>
          <button
            type="button"
            onClick={() => {
              this.setState({ failed: false })
              this.props.onRetry()
            }}
            className="mw-button mw-button--tertiary-subtle mw-button--medium"
          >
            다시 시도
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

interface KnowledgeGraphModalProps {
  open: boolean
  onClose: () => void
  result: GraphResult
  /** 폴더 id → 색 */
  colorMap: Map<string, string>
  /** 폴더 id → 이름 */
  groupNames: Map<string, string>
}

type ColorBy = 'folder' | 'topic'

const LABEL_ORDER: LabelMode[] = ['auto', 'all', 'none']
const LABEL_TEXT: Record<LabelMode, string> = { none: '라벨 없음', auto: '자동 라벨', all: '모든 라벨' }
const KIND_TEXT: Record<LinkKind, string> = { wiki: '링크', mention: '언급', tag: '태그', semantic: 'AI 연결' }
const KIND_HINT: Record<LinkKind, string> = {
  wiki: '본문의 [[메모 제목]]',
  mention: '본문에 다른 메모 제목이 그대로 나와요',
  tag: '몇 개 메모만 같이 쓰는 태그',
  semantic: '내용이 비슷한 메모 (AI 임베딩)',
}
const ALL_KINDS = new Set<LinkKind>(KIND_ORDER)

function reasonText(l: GraphLink): string {
  return l.kinds
    .map((k) => (k === 'semantic' && l.sim != null ? `AI 유사 ${Math.round(l.sim * 100)}%` : k === 'wiki' ? '[[링크]]' : k === 'mention' ? '본문 언급' : k === 'tag' ? '같은 태그' : KIND_TEXT[k]))
    .join(' · ')
}

export function KnowledgeGraphModal({ open, onClose, result, colorMap, groupNames }: KnowledgeGraphModalProps) {
  const navigate = useNavigate()
  const toast = useToastStore((s) => s.showToast)
  const { computing, semantic } = useKnowledgeGraph()
  const graphRef = useRef<ForceGraphHandle>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const [size, setSize] = useState({ width: 0, height: 0 })
  const [zoomPct, setZoomPct] = useState(100)
  const [labelMode, setLabelMode] = useState<LabelMode>('auto')
  const [query, setQuery] = useState('')
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hideOrphans, setHideOrphans] = useState(false)
  const [kinds, setKinds] = useState<Set<LinkKind>>(ALL_KINDS)
  const [colorBy, setColorBy] = useState<ColorBy>('topic')
  const [localDepth, setLocalDepth] = useState<0 | 1 | 2>(0)
  const [is3D, setIs3D] = useState(false)
  const [Lazy3D, setLazy3D] = useState(() => make3DLazy())
  // 끌어 옮긴 자리 — 필터를 바꿔도 제자리에 있게
  const livePos = useRef(new Map<string, { x: number; y: number }>())

  // AI 연결이 켜진 채 열려 있는 동안만 빠진 임베딩을 만들어요
  useEffect(() => {
    setSemanticWanted(open && kinds.has('semantic'))
    return () => setSemanticWanted(false)
  }, [open, kinds])

  // 열 때마다 처음 상태로
  useEffect(() => {
    if (!open) return
    setQuery('')
    setHighlightKey(null)
    setSelectedId(null)
    setLabelMode('auto')
    setHideOrphans(false)
    setKinds(ALL_KINDS)
    setLocalDepth(0)
    setIs3D(false)
  }, [open])

  /* ── 보여 줄 연결 · 노드 ── */
  const links = useMemo(() => {
    if (kinds.size === KIND_ORDER.length) return result.links
    const out: GraphLink[] = []
    for (const l of result.links) {
      const on = l.kinds.filter((k) => kinds.has(k))
      if (!on.length) continue
      out.push(on.length === l.kinds.length ? l : { ...l, kinds: on, kind: on[0] })
    }
    return out
  }, [result.links, kinds])

  const nodes = useMemo(() => {
    const deg = new Map<string, number>()
    for (const l of links) {
      deg.set(l.source, (deg.get(l.source) ?? 0) + 1)
      deg.set(l.target, (deg.get(l.target) ?? 0) + 1)
    }
    return result.nodes.map((n) => {
      const p = livePos.current.get(n.id)
      return { ...n, degree: deg.get(n.id) ?? 0, x: p?.x ?? n.x, y: p?.y ?? n.y }
    })
  }, [result.nodes, links])

  const adjacency = useMemo(() => {
    const adj = new Map<string, GraphLink[]>()
    for (const l of links) {
      ;(adj.get(l.source) ?? adj.set(l.source, []).get(l.source)!).push(l)
      ;(adj.get(l.target) ?? adj.set(l.target, []).get(l.target)!).push(l)
    }
    return adj
  }, [links])

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const orphanCount = useMemo(() => nodes.reduce((a, n) => a + (n.degree === 0 ? 1 : 0), 0), [nodes])

  const display = useMemo(() => {
    let keep: Set<string> | null = null
    if (localDepth > 0 && selectedId && nodeById.has(selectedId)) {
      keep = new Set([selectedId])
      let frontier = [selectedId]
      for (let d = 0; d < localDepth; d++) {
        const next: string[] = []
        for (const id of frontier) {
          for (const l of adjacency.get(id) ?? []) {
            const o = l.source === id ? l.target : l.source
            if (!keep.has(o)) {
              keep.add(o)
              next.push(o)
            }
          }
        }
        frontier = next
      }
    } else if (hideOrphans) {
      keep = new Set(nodes.filter((n) => n.degree > 0).map((n) => n.id))
    }
    if (!keep) return { nodes, links }
    const k = keep
    return { nodes: nodes.filter((n) => k.has(n.id)), links: links.filter((l) => k.has(l.source) && k.has(l.target)) }
  }, [nodes, links, adjacency, nodeById, localDepth, selectedId, hideOrphans])

  // 범위가 바뀌면(이웃만 · 고아 숨기기) 그 범위에 맞춰 보기
  useEffect(() => {
    const t = requestAnimationFrame(() => graphRef.current?.fit(true))
    return () => cancelAnimationFrame(t)
  }, [localDepth, hideOrphans])

  /* ── 색 · 범례 ── */
  const topicName = useCallback(
    (c: number) => (c < 0 ? '주제 없음' : result.communities[c]?.label ?? `주제 ${c + 1}`),
    [result.communities]
  )
  const folderName = useCallback((g: string) => groupNames.get(g) ?? (g === 'none' ? '폴더 없음' : '폴더'), [groupNames])
  const colorKeyOf = useCallback((n: GraphNode) => (colorBy === 'folder' ? n.group : `t${n.community}`), [colorBy])
  const keyColor = useCallback(
    (key: string) => {
      if (key.startsWith('t')) {
        const c = Number(key.slice(1))
        return c >= 0 && c < GROUP_COLORS.length ? GROUP_COLORS[c] : NONE_COLOR
      }
      return colorMap.get(key) || NONE_COLOR
    },
    [colorMap]
  )
  const colorOf = useCallback((n: GraphNode) => keyColor(colorKeyOf(n)), [keyColor, colorKeyOf])
  const highlight = useMemo(
    () => (highlightKey ? (n: GraphNode) => colorKeyOf(n) === highlightKey : null),
    [highlightKey, colorKeyOf]
  )

  const legend = useMemo(() => {
    if (colorBy === 'folder') {
      return result.groups.slice(0, 8).map((g) => ({ key: g, name: folderName(g), count: 0 }))
    }
    return result.communities.slice(0, 8).map((c) => ({ key: `t${c.id}`, name: c.label, count: c.size }))
  }, [colorBy, result.groups, result.communities, folderName])

  useEffect(() => setHighlightKey(null), [colorBy])

  // 3D는 group으로 색을 정하므로 색 기준 키를 group 자리에 넣어 줘요
  const nodes3D = useMemo(
    () => (is3D ? display.nodes.map((n) => ({ ...n, group: colorKeyOf(n) })) : []),
    [is3D, display.nodes, colorKeyOf]
  )
  const colorMap3D = useMemo(() => {
    const m = new Map<string, string>()
    for (const n of nodes3D) if (!m.has(n.group)) m.set(n.group, keyColor(n.group))
    return m
  }, [nodes3D, keyColor])

  /* ── 고른 노드 ── */
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null
  const neighbors = useMemo(() => {
    if (!selected) return []
    return (adjacency.get(selected.id) ?? [])
      .map((l) => ({ link: l, node: nodeById.get(l.source === selected.id ? l.target : l.source)! }))
      .filter((x) => x.node)
      .sort((a, b) => KIND_ORDER.indexOf(a.link.kind) - KIND_ORDER.indexOf(b.link.kind) || (b.link.sim ?? 0) - (a.link.sim ?? 0) || b.link.weight - a.link.weight)
  }, [selected, adjacency, nodeById])

  // 고른 노드가 화면에서 빠지면(삭제 · 동기화 · 필터) 고르기를 풀어요
  useEffect(() => {
    if (selectedId && !display.nodes.some((n) => n.id === selectedId)) {
      setSelectedId(null)
      setLocalDepth(0)
    }
  }, [display.nodes, selectedId])
  useEffect(() => {
    if (!selectedId) setLocalDepth(0)
  }, [selectedId])

  /* ── 찾기 ── */
  const matchIdxRef = useRef(0)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return display.nodes.filter((n) => n.label.toLowerCase().includes(q))
  }, [query, display.nodes])
  const handleQueryChange = useCallback((v: string) => {
    matchIdxRef.current = 0
    setQuery(v)
  }, [])
  const handleSearchKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.nativeEvent.isComposing) return // 한글 조합을 끝내는 Enter
      if (e.key !== 'Enter' || matches.length === 0) return
      e.preventDefault()
      const m = matches[matchIdxRef.current % matches.length]
      matchIdxRef.current++
      graphRef.current?.focusNode(m.id)
    },
    [matches]
  )

  // + / − 확대 · 축소, 0 전체 보기 (입력 칸에서는 그냥 글자)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === '+' || e.key === '=') graphRef.current?.zoomIn()
      else if (e.key === '-') graphRef.current?.zoomOut()
      else if (e.key === '0') graphRef.current?.fit()
      else return
      e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Esc · 바깥 누르기: 고른 것이 있으면 먼저 풀고, 없으면 닫기 (폰은 바로 닫아요 — 쓸어 닫기가 튕기지 않게)
  const handleDialogClose = useCallback(() => {
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 601px)').matches
    if (selectedId && wide) {
      setSelectedId(null)
      return
    }
    onClose()
  }, [selectedId, onClose])

  // 그래프 칸 크기 — 포털 자식은 늦게 붙어서 콜백 ref로 재요
  const areaRefCb = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    observerRef.current = ro
  }, [])
  useEffect(() => () => observerRef.current?.disconnect(), [])

  const handleActivate = useCallback(
    (id: string) => {
      navigate(`/memo/${id}`)
      onClose()
    },
    [navigate, onClose]
  )

  const handleMoved = useCallback((list: Array<{ id: string; x: number; y: number }>) => {
    for (const p of list) livePos.current.set(p.id, p)
    rememberPositions(list)
  }, [])

  const handleExport = useCallback(async () => {
    if (!graphRef.current) {
      toast('그래프를 아직 준비하고 있어요. 잠시 후 다시 시도해 주세요', 'info')
      return
    }
    try {
      await graphRef.current.exportPNG()
    } catch {
      toast('이미지를 저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }, [toast])

  const toggleKind = (k: LinkKind) =>
    setKinds((prev) => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k)
      else next.add(k)
      return next
    })

  const cycleLabel = () => setLabelMode((m) => LABEL_ORDER[(LABEL_ORDER.indexOf(m) + 1) % LABEL_ORDER.length])

  const kindCount = useMemo(() => {
    const c: Record<LinkKind, number> = { wiki: 0, mention: 0, tag: 0, semantic: 0 }
    for (const l of result.links) for (const k of l.kinds) c[k]++
    return c
  }, [result.links])

  const aiTitle = semantic.capable || semantic.ready > 0
    ? `${KIND_HINT.semantic}${semantic.skipped > 0 ? ` · ${semantic.skipped}개는 계산하지 못했어요` : ''}`
    : 'AI 연결을 새로 만들려면 OpenAI 키나 로그인이 필요해요 (이미 만든 연결은 오프라인에서도 보여요)'

  return (
    <Dialog open={open} onClose={handleDialogClose} size="5xl" noPadding>
      <div className="flex flex-col overflow-hidden rounded-t-2xl sm:rounded-xl" style={{ height: 'min(84vh, 820px)' }}>
        {/* ── 머리 ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-100 px-4 py-3 dark:border-white/[0.06] sm:px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500">
            <IcLineShare size={16} />
          </span>
          <div className="min-w-0">
            <DialogTitle as="h2" className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              지식 그래프
            </DialogTitle>
            <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400" aria-live="polite">
              메모 {display.nodes.length.toLocaleString()} · 연결 {display.links.length.toLocaleString()}
              {result.communities.length > 0 && <span className="text-[var(--text-tertiary)]"> · 주제 {result.communities.length}</span>}
              {orphanCount > 0 && <span className="text-[var(--text-tertiary)]"> · 고아 {orphanCount}</span>}
              {result.truncated && (
                <span className="text-[var(--text-tertiary)]"> · 최근 {result.nodes.length.toLocaleString()}개(전체 {result.total.toLocaleString()})</span>
              )}
              {computing && <span className="text-[var(--text-tertiary)]"> · 다시 계산하는 중</span>}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div role="search" className="contents">
              <label className="mw-searchbar hidden sm:flex w-56 flex-none">
                <IcLineSearch size={20} />
                <input
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  aria-label="메모 찾기"
                  placeholder="메모 찾기"
                  enterKeyHint="search"
                />
                {query.trim() && <span className="pr-2 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{matches.length}</span>}
              </label>
            </div>

            <button
              aria-pressed={is3D}
              type="button"
              onClick={() => setIs3D((v) => !v)}
              title={is3D ? '2D 보기로 바꾸기' : '3D 보기로 바꾸기 (처음 한 번만 불러와요)'}
              className={`mw-select-chip mw-select-chip--${is3D ? 'on' : 'off'}`}
            >
              <IcMwRotate size={16} />
              <span className="hidden md:inline">{is3D ? '2D' : '3D'}</span>
            </button>

            {/* 라벨 · 이미지 저장은 2D에서만 (3D는 둘러보기용) */}
            {!is3D && (
              <>
                <button type="button" onClick={cycleLabel} title="라벨 표시 방식 바꾸기" className="mw-button mw-button--tertiary-subtle mw-button--medium">
                  <IcMwTag size={16} />
                  <span className="hidden md:inline">{LABEL_TEXT[labelMode]}</span>
                </button>
                <button type="button" onClick={handleExport} title="이미지로 저장 (PNG)" aria-label="이미지로 저장" className="mw-icon-button">
                  <IcLineDownload size={16} />
                </button>
              </>
            )}

            <button type="button" onClick={onClose} aria-label="닫기" className="mw-icon-button">
              <IcLineClose size={20} />
            </button>
          </div>
        </div>

        {/* ── 거르기: 연결 종류 · 색 기준 · 고아 ── */}
        <div className="flex items-center gap-2 overflow-x-auto border-b border-zinc-100 px-4 py-2 dark:border-white/[0.06] sm:px-5" role="group" aria-label="그래프 거르기">
          {KIND_ORDER.map((k) => {
            const on = kinds.has(k)
            const busy = k === 'semantic' && semantic.computing
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={() => toggleKind(k)}
                title={k === 'semantic' ? aiTitle : KIND_HINT[k]}
                className={`mw-select-chip mw-select-chip--${on ? 'on' : 'off'} shrink-0`}
              >
                {k === 'semantic' && <IcMwSparkles size={16} className={clsx(busy && 'animate-pulse')} />}
                {KIND_TEXT[k]}
                <span className="tabular-nums text-[var(--text-tertiary)]">{busy ? `${semantic.progress}%` : kindCount[k].toLocaleString()}</span>
              </button>
            )
          })}

          <span className="mx-1 h-5 w-px shrink-0 bg-zinc-200 dark:bg-white/10" aria-hidden="true" />

          <div className="flex shrink-0 items-center gap-1" role="group" aria-label="색 기준">
            {(['topic', 'folder'] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={colorBy === c}
                onClick={() => setColorBy(c)}
                className={`mw-select-chip mw-select-chip--${colorBy === c ? 'on' : 'off'}`}
              >
                {c === 'topic' ? '주제 색' : '폴더 색'}
              </button>
            ))}
          </div>

          {orphanCount > 0 && localDepth === 0 && (
            <button
              aria-pressed={hideOrphans}
              type="button"
              onClick={() => setHideOrphans((v) => !v)}
              title={hideOrphans ? '모든 메모 보기' : '연결 없는 메모 숨기기'}
              className={`mw-select-chip mw-select-chip--${hideOrphans ? 'on' : 'off'} shrink-0`}
            >
              {hideOrphans ? <IcLineEye size={16} /> : <IcLineEyeHidden size={16} />}
              {hideOrphans ? '모두 보기' : `고아 ${orphanCount} 숨기기`}
            </button>
          )}
        </div>

        {/* ── 그래프 ── */}
        <div ref={areaRefCb} className="relative flex-1 overflow-hidden bg-zinc-50/60 dark:bg-black/20">
          {size.width > 0 && display.nodes.length > 0 && !is3D && (
            <ForceGraph
              ref={graphRef}
              nodes={display.nodes}
              links={display.links}
              colorOf={colorOf}
              width={size.width}
              height={size.height}
              interactive
              labelMode={labelMode}
              query={query}
              highlight={highlight}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onActivate={handleActivate}
              onZoomChange={setZoomPct}
              onMoved={handleMoved}
            />
          )}

          {size.width > 0 && display.nodes.length > 0 && is3D && (
            <Graph3DBoundary onRetry={() => setLazy3D(() => make3DLazy())}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <IcLineLoading size={16} className="animate-spin" />
                    3D 보기를 불러오고 있어요
                  </div>
                }
              >
                <Lazy3D
                  nodes={nodes3D}
                  links={display.links}
                  colorMap={colorMap3D}
                  width={size.width}
                  height={size.height}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onActivate={handleActivate}
                  query={query}
                  highlightGroup={highlightKey}
                />
              </Suspense>
            </Graph3DBoundary>
          )}

          {/* 폰 찾기 */}
          <div className="absolute left-3 right-3 top-3 flex sm:hidden">
            <div role="search" className="contents">
              <label className="mw-searchbar">
                <IcLineSearch size={20} />
                <input
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  aria-label="메모 찾기"
                  placeholder="메모 찾기"
                  enterKeyHint="search"
                />
              </label>
            </div>
          </div>

          {display.links.length === 0 && !semantic.computing && localDepth === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6">
              <p className="max-w-sm rounded-xl bg-white/80 px-4 py-3 text-center text-sm text-zinc-500 shadow-sm backdrop-blur dark:bg-zinc-900/70 dark:text-zinc-400">
                {kinds.size === 0 ? (
                  '연결 종류를 하나 이상 골라 주세요.'
                ) : (
                  <>
                    아직 메모 사이에 연결이 없어요. 본문에 <span className="font-mono text-zinc-700 dark:text-zinc-200">[[메모 제목]]</span>을 적거나, 태그를 달거나, AI 연결을 켜면 관계를 자동으로 그려요.
                  </>
                )}
              </p>
            </div>
          )}

          {/* 고른 메모 — 넓은 화면은 왼쪽 위, 폰은 아래 */}
          {selected && (
            <section
              aria-label="고른 메모"
              className="absolute inset-x-3 bottom-3 z-10 flex max-h-[45%] flex-col rounded-xl border border-zinc-200 bg-white/95 shadow-lg backdrop-blur sm:inset-x-auto sm:bottom-auto sm:left-3 sm:top-3 sm:max-h-[calc(100%-5.5rem)] sm:w-72 dark:border-white/10 dark:bg-zinc-900/90"
            >
              <div className="flex items-start gap-2 p-3.5 pb-2">
                <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorOf(selected) }} />
                <div className="min-w-0 flex-1">
                  <h3 className="mw-clamp-2 text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">{selected.label}</h3>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <IcLineFolder size={12} />
                    <span className="mw-ellipsis">{folderName(selected.group)}</span>
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                    <span className="mw-ellipsis">{topicName(selected.community)}</span>
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                    <span className="shrink-0">연결 {selected.degree}</span>
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="고르기 풀기" className="mw-icon-button -mr-1 -mt-1">
                  <IcLineClose size={16} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-2.5">
                <button
                  type="button"
                  onClick={() => handleActivate(selected.id)}
                  className="mw-button mw-button--primary mw-button--medium mw-button--icon-left"
                >
                  <IcLineExternalLink size={16} />
                  메모 열기
                </button>
                {selected.degree > 0 && (
                  <>
                    <button
                      type="button"
                      aria-pressed={localDepth === 1}
                      onClick={() => setLocalDepth((d) => (d === 1 ? 0 : 1))}
                      title="이 메모와 바로 이어진 메모만 보기"
                      className={`mw-select-chip mw-select-chip--${localDepth === 1 ? 'on' : 'off'}`}
                    >
                      이웃만
                    </button>
                    <button
                      type="button"
                      aria-pressed={localDepth === 2}
                      onClick={() => setLocalDepth((d) => (d === 2 ? 0 : 2))}
                      title="이웃의 이웃까지 보기"
                      className={`mw-select-chip mw-select-chip--${localDepth === 2 ? 'on' : 'off'}`}
                    >
                      2단계까지
                    </button>
                  </>
                )}
              </div>

              {neighbors.length > 0 && (
                <div className="min-h-0 flex-1 overflow-y-auto border-t border-zinc-100 py-1 dark:border-white/[0.06]">
                  <p className="px-3.5 pb-1 pt-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">이어진 메모 {neighbors.length}</p>
                  <ul>
                    {neighbors.map(({ link, node }) => (
                      <li key={node.id}>
                        <button
                          type="button"
                          onClick={() => graphRef.current?.focusNode(node.id)}
                          className="flex min-h-11 w-full items-center gap-2 px-3.5 py-1.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04]"
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: colorOf(node) }} />
                          <span className="min-w-0 flex-1">
                            <span className="mw-ellipsis block text-sm text-zinc-800 dark:text-zinc-200">{node.label}</span>
                            <span className="mw-ellipsis block text-xs text-zinc-500 dark:text-zinc-400">{reasonText(link)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* 범례 — 누르면 그 묶음만 강조 */}
          {legend.length > 0 && !is3D && !selected && (
            <div className="absolute bottom-3 left-3 z-[5] hidden max-w-[min(70%,44rem)] flex-wrap gap-1.5 rounded-xl border border-zinc-200 bg-white/90 p-2 shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-zinc-900/80">
              {legend.map((g) => {
                const on = highlightKey === g.key
                return (
                  <button
                    aria-pressed={on}
                    key={g.key}
                    type="button"
                    onClick={() => setHighlightKey(on ? null : g.key)}
                    className={`mw-select-chip mw-select-chip--${on ? 'on' : 'off'}`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: keyColor(g.key) }} />
                    <span className="mw-ellipsis max-w-[9rem]">{g.name}</span>
                    {g.count > 0 && <span className="tabular-nums text-[var(--text-tertiary)]">{g.count}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* 확대 · 축소 (2D) — 폰에서 고른 메모가 아래를 쓰는 동안은 숨겨요 */}
          {!is3D && (
            <div
              className={clsx(
                'absolute bottom-3 right-3 z-[5] items-center gap-0.5 rounded-xl border border-zinc-200 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/80',
                selected ? 'hidden sm:flex' : 'flex'
              )}
            >
              <button type="button" onClick={() => graphRef.current?.zoomOut()} aria-label="축소" className="mw-icon-button">
                <IcMwZoomOut size={16} />
              </button>
              <span className="w-11 text-center text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{zoomPct}%</span>
              <button type="button" onClick={() => graphRef.current?.zoomIn()} aria-label="확대" className="mw-icon-button">
                <IcMwZoomIn size={16} />
              </button>
              <button type="button" onClick={() => graphRef.current?.reset()} aria-label="전체 보기" title="전체 보기" className="mw-icon-button">
                <IcLineExpand size={16} />
              </button>
            </div>
          )}

          <p className="pointer-events-none absolute left-1/2 top-3 z-0 hidden -translate-x-1/2 text-xs text-zinc-400 lg:block dark:text-zinc-500">
            {is3D
              ? '끌어 돌리기 · 휠 확대 · 오른쪽 끌어 옮기기 · 누르면 고르고 한 번 더 누르면 열기'
              : '끌어 옮기기 · 휠/두 손가락 확대 · 빈 곳 두 번 눌러 전체 보기 · 실선 [[링크]] · 점선 자동 연결'}
          </p>
        </div>
      </div>
    </Dialog>
  )
}
