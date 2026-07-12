import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Folder as FolderIcon,
  Frame,
  Search,
  Share2,
  Tag,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { clsx } from 'clsx'
import { DialogTitle } from '@headlessui/react'
import { Dialog } from '@/components/ui/Dialog'
import { useToastStore } from '@/stores/toastStore'
import type { GraphLink, GraphNode } from '@/hooks/useGraphData'
import { ForceGraph, type ForceGraphHandle, type LabelMode } from './ForceGraph'

interface KnowledgeGraphModalProps {
  open: boolean
  onClose: () => void
  nodes: GraphNode[]
  links: GraphLink[]
  groups: string[]
  /** 그룹(폴더 id) → 색상 */
  colorMap: Map<string, string>
  /** 그룹(폴더 id) → 폴더 이름 */
  groupNames: Map<string, string>
  /** 전체 메모 수 (성능 상한 초과 시 total > nodes.length) */
  total?: number
  truncated?: boolean
  orphanCount?: number
}

const LABEL_ORDER: LabelMode[] = ['auto', 'all', 'none']
const LABEL_TEXT: Record<LabelMode, string> = {
  none: '라벨 없음',
  auto: '자동 라벨',
  all: '모든 라벨',
}

export function KnowledgeGraphModal({
  open,
  onClose,
  nodes,
  links,
  groups,
  colorMap,
  groupNames,
  total,
  truncated,
  orphanCount = 0,
}: KnowledgeGraphModalProps) {
  const navigate = useNavigate()
  const toast = useToastStore((s) => s.showToast)
  const graphRef = useRef<ForceGraphHandle>(null)
  const observerRef = useRef<ResizeObserver | null>(null)

  const [size, setSize] = useState({ width: 0, height: 0 })
  const [zoomPct, setZoomPct] = useState(100)
  const [labelMode, setLabelMode] = useState<LabelMode>('auto')
  const [query, setQuery] = useState('')
  const [highlightGroup, setHighlightGroup] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hideOrphans, setHideOrphans] = useState(false)

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const selected = selectedId ? nodeById.get(selectedId) ?? null : null

  // 고아(연결 0) 숨기기 — 데이터 레벨에서 필터해 ForceGraph가 연결된 노드에 맞춰 재배치
  const display = useMemo(() => {
    if (!hideOrphans) return { nodes, links }
    const keep = new Set(nodes.filter((n) => n.degree > 0).map((n) => n.id))
    return {
      nodes: nodes.filter((n) => keep.has(n.id)),
      links: links.filter((l) => keep.has(l.source) && keep.has(l.target)),
    }
  }, [hideOrphans, nodes, links])

  // 모달이 열릴 때마다 상호작용 상태 초기화
  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlightGroup(null)
      setSelectedId(null)
      setLabelMode('auto')
      setHideOrphans(false)
    }
  }, [open])

  // 검색 일치 목록 — Enter로 순환 점프, 카운터 표시
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
      // 한글 IME 조합 확정 Enter는 무시 — 의도치 않은 카메라 점프·선택 방지
      if (e.nativeEvent.isComposing) return
      if (e.key !== 'Enter' || matches.length === 0) return
      e.preventDefault()
      const m = matches[matchIdxRef.current % matches.length]
      matchIdxRef.current++
      graphRef.current?.focusNode(m.id)
    },
    [matches]
  )

  // 그래프 단축키 — +/− 줌, 0 전체 보기 (입력 필드 포커스 중엔 무시)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === '+' || e.key === '=') {
        graphRef.current?.zoomIn()
        e.preventDefault()
      } else if (e.key === '-') {
        graphRef.current?.zoomOut()
        e.preventDefault()
      } else if (e.key === '0') {
        graphRef.current?.fit()
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // Esc·바깥 클릭: 선택이 있으면 먼저 해제하고, 없을 때 닫기 — 단계적 이탈.
  // 단, 상세 패널이 보이는 sm 이상에서만 — 모바일(패널 숨김)에선 스와이프 닫기가
  // 이유 없이 튕겨 보이므로 즉시 닫는다.
  const handleDialogClose = useCallback(() => {
    const detailVisible =
      typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches
    if (selectedId && detailVisible) {
      setSelectedId(null)
      return
    }
    onClose()
  }, [selectedId, onClose])

  // 선택 노드가 데이터에서 사라지면(삭제·동기화·고아 숨김) 선택 해제 —
  // 유령 선택이 단계적 닫기를 보이지 않게 삼키는 것 방지
  useEffect(() => {
    if (selectedId && !display.nodes.some((n) => n.id === selectedId)) {
      setSelectedId(null)
    }
  }, [display.nodes, selectedId])

  // 그래프 영역 크기 측정 — Headless UI 포털 자식은 [open] 이펙트보다 늦게 부착되므로 콜백 ref로 측정
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

  const handleExport = useCallback(async () => {
    if (!graphRef.current) {
      toast('그래프가 아직 준비되지 않았습니다', 'info')
      return
    }
    try {
      await graphRef.current.exportPNG()
    } catch {
      toast('이미지 저장에 실패했습니다', 'error')
    }
  }, [toast])

  const cycleLabel = () =>
    setLabelMode((m) => LABEL_ORDER[(LABEL_ORDER.indexOf(m) + 1) % LABEL_ORDER.length])

  const legendGroups = useMemo(() => groups.slice(0, 8), [groups])
  const folderName = (g: string) => groupNames.get(g) ?? (g === 'none' ? '폴더 없음' : '폴더')

  return (
    <Dialog open={open} onClose={handleDialogClose} size="5xl" noPadding>
      <div className="flex flex-col overflow-hidden rounded-t-2xl sm:rounded-xl" style={{ height: 'min(80vh, 780px)' }}>
        {/* ── 헤더 / 툴바 ── */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-100 px-4 py-3 dark:border-white/[0.06] sm:px-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-500 dark:bg-primary-900/20 dark:text-primary-400">
            <Share2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <DialogTitle as="h2" className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              지식 그래프
            </DialogTitle>
            <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
              메모 {nodes.length} · 연결 {links.length}
              {orphanCount > 0 && <span className="text-zinc-400 dark:text-zinc-500"> · 고아 {orphanCount}</span>}
              {truncated && total != null && (
                <span className="text-zinc-400 dark:text-zinc-500"> · 최근 {nodes.length}개(전체 {total})</span>
              )}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <div className="relative hidden sm:block">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="메모 검색"
                placeholder="메모 검색 (Enter로 이동)"
                className="h-9 w-48 rounded-lg border border-zinc-200 bg-white pl-8 pr-9 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-100"
              />
              {query.trim() && (
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-zinc-400">
                  {matches.length}
                </span>
              )}
            </div>

            {orphanCount > 0 && (
              <button
                type="button"
                onClick={() => setHideOrphans((v) => !v)}
                title={hideOrphans ? '모든 메모 보기' : '연결 없는 메모 숨기기'}
                className={clsx(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                  hideOrphans
                    ? 'border-primary-300 bg-primary-50 text-primary-600 dark:border-primary-500/40 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.04]'
                )}
              >
                {hideOrphans ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                <span className="hidden md:inline">{hideOrphans ? '전체' : `고아 ${orphanCount}`}</span>
              </button>
            )}

            <button
              type="button"
              onClick={cycleLabel}
              title="라벨 표시 방식 전환"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.04]"
            >
              <Tag className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{LABEL_TEXT[labelMode]}</span>
            </button>

            <button
              type="button"
              onClick={handleExport}
              title="이미지로 저장 (PNG)"
              aria-label="이미지로 저장"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 dark:border-white/10 dark:text-zinc-300 dark:hover:bg-white/[0.04]"
            >
              <Download className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── 그래프 영역 ── */}
        <div ref={areaRefCb} className="relative flex-1 overflow-hidden bg-zinc-50/60 dark:bg-black/20">
          {size.width > 0 && display.nodes.length > 0 && (
            <ForceGraph
              ref={graphRef}
              nodes={display.nodes}
              links={display.links}
              colorMap={colorMap}
              width={size.width}
              height={size.height}
              interactive
              labelMode={labelMode}
              query={query}
              highlightGroup={highlightGroup}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onActivate={handleActivate}
              onZoomChange={setZoomPct}
            />
          )}

          {/* 모바일 검색 */}
          <div className="absolute left-3 right-3 top-3 sm:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                aria-label="메모 검색"
                placeholder="메모 검색 (Enter로 이동)"
                className="h-9 w-full rounded-lg border border-zinc-200 bg-white/90 pl-8 pr-2.5 text-sm text-zinc-800 shadow-sm backdrop-blur placeholder:text-zinc-400 focus:border-primary-400 focus:outline-none dark:border-white/10 dark:bg-zinc-900/80 dark:text-zinc-100"
              />
            </div>
          </div>

          {/* 링크가 하나도 없을 때 안내 */}
          {links.length === 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-center px-6">
              <p className="max-w-sm rounded-xl bg-white/80 px-4 py-3 text-center text-sm text-zinc-500 shadow-sm backdrop-blur dark:bg-zinc-900/70 dark:text-zinc-400">
                아직 메모 간 연결이 없습니다. 메모 본문에 <span className="font-mono text-zinc-700 dark:text-zinc-200">[[다른 메모 제목]]</span> 을 적으면 여기에 관계가 그려집니다.
              </p>
            </div>
          )}

          {/* 선택 노드 상세 */}
          {selected && (
            <div className="absolute left-3 top-3 z-10 hidden w-64 rounded-xl border border-zinc-200 bg-white/95 p-3.5 shadow-lg backdrop-blur sm:block dark:border-white/10 dark:bg-zinc-900/90">
              <div className="flex items-start gap-2">
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorMap.get(selected.group) || '#a1a1aa' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
                    {selected.label}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                    <FolderIcon className="h-3 w-3" />
                    <span className="truncate">{folderName(selected.group)}</span>
                    <span className="text-zinc-300 dark:text-zinc-600">·</span>
                    <span>연결 {selected.degree}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  aria-label="선택 해제"
                  className="-mr-1 -mt-1 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleActivate(selected.id)}
                className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                메모 열기
              </button>
            </div>
          )}

          {/* 범례 (폴더) */}
          {legendGroups.length > 0 && (
            <div className="absolute bottom-3 left-3 z-10 hidden max-w-[min(60%,22rem)] flex-wrap gap-1.5 rounded-xl border border-zinc-200 bg-white/90 p-2 shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-zinc-900/80">
              {legendGroups.map((g) => {
                const on = highlightGroup === g
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setHighlightGroup(on ? null : g)}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
                      on
                        ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10'
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorMap.get(g) || '#a1a1aa' }} />
                    {folderName(g)}
                  </button>
                )
              })}
            </div>
          )}

          {/* 줌 컨트롤 */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-xl border border-zinc-200 bg-white/90 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-900/80">
            <button
              type="button"
              onClick={() => graphRef.current?.zoomOut()}
              aria-label="축소"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-11 text-center text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{zoomPct}%</span>
            <button
              type="button"
              onClick={() => graphRef.current?.zoomIn()}
              aria-label="확대"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => graphRef.current?.reset()}
              aria-label="전체 보기"
              title="전체 보기"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              <Frame className="h-4 w-4" />
            </button>
          </div>

          {/* 조작 힌트 */}
          <p className="pointer-events-none absolute left-1/2 top-3 z-0 hidden -translate-x-1/2 text-[11px] text-zinc-400 sm:block dark:text-zinc-500">
            드래그 이동 · 휠/핀치 줌 · 노드 탭 선택 · 더블클릭/0 전체 보기 · +/− 줌
          </p>
        </div>
      </div>
    </Dialog>
  )
}
