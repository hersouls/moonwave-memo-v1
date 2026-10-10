import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import type { Memo } from '@/lib/types'
import { MemoCard } from './MemoCard'
import { TimelineView } from './TimelineView'
import { KanbanView } from './KanbanView'
import { MemoFilterTabs } from './MemoFilterTabs'
import { MemoSearchBar } from './MemoSearchBar'
import { MemoContextMenu } from './MemoContextMenu'
import { MemoEmptyState } from './MemoEmptyState'
import { BatchActionBar } from './BatchActionBar'
import { QuickMemoInput } from './QuickMemoInput'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FeatureHint } from '@/components/ui/FeatureHint'
import { useMemoFilters } from '@/hooks/useMemoFilters'
import { CreateActions, PageHead } from '@/components/layout/PageHead'
import { Button } from '@/mw/Button'
import { usePinchZoom } from '@/hooks/usePinchZoom'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { IcLineMore, IcLinePin, IcLineTrash } from '@/mw/icons'

// PERF-01: initial visible count
const INITIAL_VISIBLE = 30
// 목록 보기: 한 줄에 카드 하나. 내용 영역이 넓으면 읽기 좋은 너비에서 멈춰요.
const LIST_CLASS = 'flex flex-col gap-2.5 @lg:max-w-3xl @lg:mx-auto'
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

// Skeleton loading card for infinite scroll — mirrors the real card anatomy
// (hairline border, radius, px-4 py-3.5, gap-1.5, 20px title line) so content swap-in doesn't jolt
function SkeletonMemoCard() {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl fold:rounded-xl border border-[var(--card-hairline)] bg-white dark:bg-zinc-800 px-4 py-3.5 shadow-sm">
      <div className="h-5 w-3/4 rounded bg-zinc-100 dark:bg-zinc-700/60 skeleton-shimmer" />
      <div className="h-4 w-full rounded bg-zinc-100 dark:bg-zinc-700/60 skeleton-shimmer" />
      <div className="h-4 w-2/3 rounded bg-zinc-100 dark:bg-zinc-700/60 skeleton-shimmer" />
      <div className="h-[13px] w-1/4 rounded bg-zinc-100 dark:bg-zinc-700/60 skeleton-shimmer" />
    </div>
  )
}

export function MemoList() {
  const filteredMemos = useMemoFilters()
  const viewMode = useUIStore((s) => s.viewMode)
  const { gridClass, handleTouchStart, handleTouchMove } = usePinchZoom()
  const isSelectionMode = useUIStore((s) => s.isSelectionMode)
  const isDesktop = useUIStore((s) => s.isDesktop)
  const openContextMenu = useUIStore((s) => s.openContextMenu)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const folders = useFolderStore((s) => s.folders)
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
  }, [focusedIndex, filteredMemos.length, visibleCount, navigate])

  // Auto-scroll focused item into view + move real DOM focus so :focus-visible,
  // screen-reader position, and Enter activation all follow the j/k cursor
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return
    if (focusedIndex >= visibleMemosRef.current.length) {
      setFocusedIndex(-1)
      return
    }
    const items = listRef.current.querySelectorAll<HTMLElement>('[data-memo-item]')
    const item = items[focusedIndex]
    if (item) {
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      item.querySelector<HTMLElement>('.memo-card__link')?.focus({ preventScroll: true })
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

  // Pinned section partition — useMemoFilters already returns [...pinned, ...unpinned],
  // so the split preserves visibleMemos indices for j/k focus and stagger delays
  const pinnedMemos = visibleMemos.filter((m) => m.isPinned)
  const unpinnedMemos = visibleMemos.filter((m) => !m.isPinned)
  const showPinnedSections = pinnedMemos.length > 0 && unpinnedMemos.length > 0

  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => c + LOAD_MORE_COUNT)
  }, [])

  // Swipe onboarding hint
  const [showSwipeHint] = useState(() => {
    try {
      const dismissed = JSON.parse(localStorage.getItem('memo-dismissed-hints') || '[]')
      return !dismissed.includes('swipe-onboarding')
    } catch { return true }
  })

  const trashFolder = getTrashFolder()
  const isTrashView = trashFolder != null && activeFolderId === trashFolder.id

  // 지금 보고 있는 목록의 이름이 이 화면의 제목이에요
  const pageTitle = isTrashView ? '휴지통'
    : activeFolderId != null ? (folders.find((f) => f.id === activeFolderId)?.name ?? '메모')
    : activeTag ? `#${activeTag}`
    : activeFilter === 'starred' ? '중요' : '메모'

  const handleEmptyTrash = async () => {
    await emptyTrash()
    setIsEmptyTrashOpen(false)
  }

  return (
    <div className="mw-page">
      <PageHead
        title={pageTitle}
        actions={
          <>
            <Button variant="tertiary-subtle" size="medium" onClick={() => setShowQuickMemo(true)}>빠른 메모</Button>
            <CreateActions />
          </>
        }
      />
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
          <button type="button"
            onClick={() => setIsEmptyTrashOpen(true)}
            className="mw-button mw-button--tertiary-subtle mw-button--medium mw-button--icon-left shrink-0"
            aria-label="휴지통 비우기"
          >
            <IcLineTrash size={16} />
            비우기
          </button>
        )}
        <button
          onClick={openContextMenu}
          className="mw-icon-button shrink-0"
          aria-label="더보기 메뉴"
        >
          <IcLineMore size={20} className="text-zinc-500 dark:text-zinc-400" />
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

      {/* 손짓 안내: 손가락으로 쓰는 화면에서 한 번, 목록 위에 */}
      {showSwipeHint && !isDesktop && filteredMemos.length > 0 && viewMode !== 'kanban' && (
        <div className="mt-3">
          <FeatureHint id="swipe-onboarding" message="카드를 옆으로 밀면 중요 표시나 삭제를 할 수 있어요. 길게 누르면 여러 개를 골라요." />
        </div>
      )}

      {/* Memo list / grid / timeline */}
      {filteredMemos.length === 0 ? (
        <MemoEmptyState />
      ) : viewMode === 'kanban' ? (
        <div className="mt-3 pb-4">
          <KanbanView memos={filteredMemos} />
        </div>
      ) : viewMode === 'timeline' ? (
        <div className="mt-3 pb-4">
          <TimelineView memos={visibleMemos} />
        </div>
      ) : (() => {
        // Keyboard focus follows real DOM focus (.memo-card__link), so the wrapper
        // needs no cursor ring — see the focus effect above
        const renderMemoItem = (memo: Memo, index: number) => (
          <div
            key={memo.id}
            data-memo-item
            className={clsx(
              'animate-in slide-in-from-bottom',
              viewMode === 'grid' && 'h-full',
              showSwipeHint && index === 0 && 'animate-wiggle'
            )}
            style={{
              animationDuration: 'var(--motion-duration-medium)',
              animationDelay: index < 8 ? `${index * 30}ms` : '0ms',
              animationFillMode: 'both',
            }}
          >
            <MemoCard memo={memo} viewMode={viewMode === 'grid' ? 'grid' : 'list'} isTrashView={isTrashView} />
          </div>
        )
        const sectionHeaderClass = clsx(
          'flex items-center gap-1.5 px-1 pb-1 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400',
          viewMode === 'grid' && 'col-span-full'
        )
        return (
          <div
            ref={listRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            className={clsx(
              'mt-3 pb-4',
              viewMode === 'grid' ? gridClass : LIST_CLASS
            )}
          >
            {showPinnedSections ? (
              <>
                <div className={sectionHeaderClass}>
                  <IcLinePin size={12} className="rotate-[-30deg]" />
                  고정됨
                </div>
                {pinnedMemos.map((memo, index) => renderMemoItem(memo, index))}
                <div className={clsx(sectionHeaderClass, 'mt-1.5')}>메모</div>
                {unpinnedMemos.map((memo, index) => renderMemoItem(memo, pinnedMemos.length + index))}
              </>
            ) : (
              visibleMemos.map((memo, index) => renderMemoItem(memo, index))
            )}
          </div>
        )
      })()}

      {/* Skeleton loading + Infinite scroll sentinel */}
      {hasMore && (
        <>
          <div className={viewMode === 'grid' ? gridClass : LIST_CLASS}>
            {Array.from({ length: viewMode === 'grid' ? 4 : 2 }, (_, i) => <SkeletonMemoCard key={i} />)}
          </div>
          <InfiniteScrollSentinel onIntersect={handleLoadMore} />
        </>
      )}

      {/* Selection mode bar */}
      {isSelectionMode && <BatchActionBar isTrashView={isTrashView} />}

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
