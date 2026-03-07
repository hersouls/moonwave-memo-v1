import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { MoreVertical, Trash2, RefreshCw } from 'lucide-react'
import clsx from 'clsx'
import { MemoCard } from './MemoCard'
import { TimelineView } from './TimelineView'
import { KanbanView } from './KanbanView'
import { MemoFilterTabs } from './MemoFilterTabs'
import { MemoSearchBar } from './MemoSearchBar'
import { MemoContextMenu } from './MemoContextMenu'
import { MemoEmptyState } from './MemoEmptyState'
import { BatchActionBar } from './BatchActionBar'
import { QuickMemoInput } from './QuickMemoInput'
import { FAB } from '@/components/ui/FAB'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FeatureHint } from '@/components/ui/FeatureHint'
import { useMemoFilters } from '@/hooks/useMemoFilters'
import { usePullToRefresh } from '@/hooks/usePullToRefresh'
import { useSpeculationRules } from '@/hooks/useSpeculationRules'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'

// PERF-01: initial visible count
const INITIAL_VISIBLE = 30
const LOAD_MORE_COUNT = 30

// Infinite scroll sentinel using IntersectionObserver
function InfiniteScrollSentinel({ onIntersect }: { onIntersect: () => void }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const onIntersectRef = useRef(onIntersect)
  onIntersectRef.current = onIntersect

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onIntersectRef.current()
      },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return <div ref={sentinelRef} className="h-1" />
}

// Skeleton loading card for infinite scroll
function SkeletonMemoCard() {
  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 p-4 shadow-sm">
      <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700 skeleton-shimmer mb-3" />
      <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-700 skeleton-shimmer mb-2" />
      <div className="h-3 w-2/3 rounded bg-zinc-100 dark:bg-zinc-700 skeleton-shimmer mb-3" />
      <div className="h-2.5 w-1/4 rounded bg-zinc-100 dark:bg-zinc-700 skeleton-shimmer" />
    </div>
  )
}

export function MemoList() {
  const filteredMemos = useMemoFilters()
  const viewMode = useUIStore((s) => s.viewMode)
  const { gridColsClass, handleTouchStart, handleTouchMove } = usePinchZoom()
  const isSelectionMode = useUIStore((s) => s.isSelectionMode)
  const openContextMenu = useUIStore((s) => s.openContextMenu)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const activeTag = useUIStore((s) => s.activeTag)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const emptyTrash = useMemoStore((s) => s.emptyTrash)
  const getTrashFolder = useFolderStore((s) => s.getTrashFolder)
  const navigate = useNavigate()

  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState(false)
  const [showQuickMemo, setShowQuickMemo] = useState(false)
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)
  const visibleMemosRef = useRef<typeof filteredMemos>([])


  // j/k keyboard navigation (vim-style)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in input/textarea
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      // Don't intercept if any modifier is pressed
      if (e.ctrlKey || e.metaKey || e.altKey) return

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusedIndex((prev) => Math.min(prev + 1, visibleMemosRef.current.length - 1))
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && focusedIndex >= 0) {
        e.preventDefault()
        const memo = visibleMemosRef.current[focusedIndex]
        if (memo?.id) navigate(`/memo/${memo.id}`)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, filteredMemos.length, visibleCount])

  // Auto-scroll focused item into view
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return
    if (focusedIndex >= visibleMemosRef.current.length) {
      setFocusedIndex(-1)
      return
    }
    const items = listRef.current.children
    if (items[focusedIndex]) {
      (items[focusedIndex] as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [focusedIndex])

  // Reset focus when filters change
  useEffect(() => {
    setFocusedIndex(-1)
  }, [activeFolderId, activeFilter, activeTag, searchQuery])

  // Reset visible count when filters change
  const filterKey = `${activeFolderId}-${activeFilter}-${activeTag}-${searchQuery}`
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey)
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey)
    setVisibleCount(INITIAL_VISIBLE)
  }

  const visibleMemos = filteredMemos.slice(0, visibleCount)
  visibleMemosRef.current = visibleMemos
  const hasMore = filteredMemos.length > visibleCount

  // Speculation Rules: prerender top visible memo pages
  const visibleMemoIds = visibleMemos.slice(0, 10).map((m) => m.id).filter((id): id is number => Boolean(id))
  useSpeculationRules(visibleMemoIds)

  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => c + LOAD_MORE_COUNT)
  }, [])

  const { bind: bindPull, pullDistance, isRefreshing } = usePullToRefresh(async () => {
    setShowQuickMemo(true)
  })

  // Swipe onboarding hint
  const [showSwipeHint] = useState(() => {
    try {
      const dismissed = JSON.parse(localStorage.getItem('memo-dismissed-hints') || '[]')
      return !dismissed.includes('swipe-onboarding')
    } catch { return true }
  })

  const trashFolder = getTrashFolder()
  const isTrashView = trashFolder != null && activeFolderId === trashFolder.id

  const handleEmptyTrash = async () => {
    await emptyTrash()
    setIsEmptyTrashOpen(false)
  }

  return (
    <div {...bindPull()} className="mx-auto w-full max-w-4xl lg:max-w-none lg:px-6">
      {/* Pull-to-refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div className="flex justify-center overflow-hidden" style={{ height: Math.min(pullDistance, 60) }}>
          <RefreshCw
            className={clsx('w-5 h-5 text-primary-500 mt-2', isRefreshing && 'animate-spin')}
            style={!isRefreshing ? { transform: `rotate(${Math.min(pullDistance * 4, 360)}deg)` } : undefined}
          />
        </div>
      )}
      {/* Quick memo input */}
      {showQuickMemo && (
        <QuickMemoInput onClose={() => setShowQuickMemo(false)} />
      )}
      {/* Filter tabs + context menu button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <MemoFilterTabs />
        </div>
        {isTrashView && filteredMemos.length > 0 && (
          <button
            onClick={() => setIsEmptyTrashOpen(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-danger-500 hover:bg-danger-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="휴지통 비우기"
          >
            <Trash2 className="w-3.5 h-3.5" />
            비우기
          </button>
        )}
        <button
          onClick={openContextMenu}
          className="f-icon-btn shrink-0 mr-4 lg:mr-0"
          aria-label="더보기 메뉴"
        >
          <MoreVertical className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      {/* Search bar */}
      <div className="mt-2">
        <MemoSearchBar />
      </div>

      {/* A11Y: Search results count for screen readers */}
      {searchQuery && (
        <div className="sr-only" role="status" aria-live="polite">
          {filteredMemos.length === 0
            ? `"${searchQuery}" 검색 결과가 없습니다.`
            : `"${searchQuery}" 검색 결과 ${filteredMemos.length}개`}
        </div>
      )}

      {/* Memo list / grid / timeline */}
      {filteredMemos.length === 0 ? (
        <MemoEmptyState />
      ) : viewMode === 'kanban' ? (
        <div className="mt-3 px-4 fold:px-2.5 pb-4 lg:px-0">
          <KanbanView memos={filteredMemos} />
        </div>
      ) : viewMode === 'timeline' ? (
        <div className="mt-3 px-4 fold:px-2.5 pb-4 lg:px-0">
          <TimelineView memos={visibleMemos} />
        </div>
      ) : (
        <div
          ref={listRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className={clsx(
            'mt-3 px-4 fold:px-2.5 pb-4 lg:px-0',
            '@container',
            viewMode === 'grid'
              ? `grid ${gridColsClass} fold:!grid-cols-1 gap-3 fold:gap-2`
              : 'flex flex-col gap-2.5 fold:gap-2 @lg:max-w-3xl @lg:mx-auto'
          )}
        >
          {visibleMemos.map((memo, index) => (
            <div
              key={memo.id}
              className={clsx(
                'animate-in slide-in-from-bottom',
                focusedIndex === index && 'ring-2 ring-primary-500 rounded-2xl',
                showSwipeHint && index === 0 && 'animate-wiggle'
              )}
              style={{
                animationDuration: '200ms',
                animationDelay: index < 15 ? `${index * 50}ms` : '0ms',
                animationFillMode: 'both',
              }}
            >
              <MemoCard memo={memo} viewMode={viewMode === 'grid' ? 'grid' : 'list'} />
              {showSwipeHint && index === 0 && (
                <FeatureHint id="swipe-onboarding" message="좌우로 밀어 중요 표시/삭제할 수 있습니다. 길게 눌러 선택 모드로 진입합니다." />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Skeleton loading + Infinite scroll sentinel */}
      {hasMore && (
        <>
          <div className={clsx(
            'px-4 fold:px-2.5 lg:px-0',
            '@container',
            viewMode === 'grid'
              ? 'grid grid-cols-1 @2xs:grid-cols-2 fold:!grid-cols-1 gap-3 fold:gap-2 @sm:grid-cols-3 @lg:grid-cols-4 @xl:grid-cols-5'
              : 'flex flex-col gap-2.5 fold:gap-2 @lg:max-w-3xl @lg:mx-auto'
          )}>
            {Array.from({ length: viewMode === 'grid' ? 4 : 2 }, (_, i) => <SkeletonMemoCard key={i} />)}
          </div>
          <InfiniteScrollSentinel onIntersect={handleLoadMore} />
        </>
      )}

      {/* Selection mode bar */}
      {isSelectionMode && <BatchActionBar />}

      {/* FAB - hidden in selection mode */}
      {!isSelectionMode && <FAB />}

      {/* Context menu bottom sheet */}
      <MemoContextMenu />

      {/* Empty trash confirmation */}
      <ConfirmDialog
        open={isEmptyTrashOpen}
        onClose={() => setIsEmptyTrashOpen(false)}
        onConfirm={handleEmptyTrash}
        title="휴지통 비우기"
        description="휴지통의 모든 메모가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        confirmText="비우기"
        variant="danger"
      />
    </div>
  )
}
