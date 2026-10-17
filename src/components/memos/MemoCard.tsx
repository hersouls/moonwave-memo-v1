import { Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import clsx from 'clsx'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Memo } from '@/lib/types'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUndoStore } from '@/stores/undoStore'
import { formatMemoDate } from '@/utils/format'
import { maskSensitiveData, stripMarkdown } from '@/utils/textUtils'
import { useSettingsStore } from '@/stores/settingsStore'
import { useToastStore } from '@/stores/toastStore'
import { useViewTransition } from '@/hooks/useViewTransition'
import { useMemoryDecay } from '@/hooks/useMemoryDecay'
import { MemoHoverPreview } from './MemoHoverPreview'
import { IcFillPlay, IcLinePin, IcLineTrash, IcLineUndo, IcMwCheckCircle, IcMwFlame, IcMwStar, IcMwStarFill } from '@/mw/icons'
import { ItemMoreButton, SortSlotContext, SwipeItem, itemActions } from '@/mw/SwipeItem'
import type { ItemAction } from '@/mw/SwipeItem'
import { useGesture } from '@/mw/gestures'
import { useLongPress } from '@/mw/useLongPress'

// 메모 줄은 길게 누르면 선택 모드가 열려요(patterns/selection-mode#press). 키트의 SwipeItem은 길게 누르기를 메뉴로 받으니,
// 순서 바꾸는 목록 안의 줄과 같은 표시(dragging)를 줘서 그 길을 끄고 메뉴는 ⋯ 버튼과 오른쪽 클릭에 맡겨요.
const OWN_PRESS = { index: 0, count: 1, moveTo: () => {}, dragging: true } as const


// Highlight search query matches in text
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>

  const parts: { text: string; match: boolean }[] = []
  const lower = text.toLowerCase()
  const q = query.toLowerCase().trim()
  let lastIndex = 0

  let idx = lower.indexOf(q, lastIndex)
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), match: false })
    }
    parts.push({ text: text.slice(idx, idx + q.length), match: true })
    lastIndex = idx + q.length
    idx = lower.indexOf(q, lastIndex)
  }
  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), match: false })
  }

  if (parts.length === 0) return <>{text}</>

  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark key={i} className="bg-primary-500/20 text-inherit rounded-sm -mx-px px-px">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </>
  )
}

interface MemoCardProps {
  memo: Memo
  viewMode?: 'list' | 'grid'
  isTrashView?: boolean
  /** 목록의 첫 줄이면 처음 한 번 살짝 밀렸다 돌아와요 */
  hint?: boolean
}

export const MemoCard = memo(function MemoCard({ memo, viewMode = 'list', isTrashView = false, hint = false }: MemoCardProps) {
  const { navigateWithTransition } = useViewTransition()
  const location = useLocation()
  // PERF-02: Subscribe only to the needed folder, not entire array
  const folder = useFolderStore(
    useCallback(
      (s) => memo.folderId != null ? s.folders.find((f) => f.id === memo.folderId) ?? null : null,
      [memo.folderId]
    )
  )
  const isSelectionMode = useUIStore((s) => s.isSelectionMode)
  const selectedMemoIds = useUIStore((s) => s.selectedMemoIds)
  const toggleMemoSelection = useUIStore((s) => s.toggleMemoSelection)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const digitalGardenEnabled = useSettingsStore((s) => s.settings.livingWorkspace.digitalGardenEnabled)
  const toggleStar = useMemoStore((s) => s.toggleStar)
  const togglePin = useMemoStore((s) => s.togglePin)
  const softDelete = useMemoStore((s) => s.softDelete)
  const restore = useMemoStore((s) => s.restore)
  const permanentDelete = useMemoStore((s) => s.permanentDelete)
  const pushUndo = useUndoStore((s) => s.pushUndo)

  const { style: decayStyle, isRecent } = useMemoryDecay(memo.updatedAt, digitalGardenEnabled)

  const isDesktop = useUIStore((s) => s.isDesktop)
  const openSlideView = useUIStore((s) => s.openSlideView)
  const [starPulse, setStarPulse] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [permanentAsk, setPermanentAsk] = useState(false)

  // Hover preview state (desktop only)
  const [showHoverPreview, setShowHoverPreview] = useState(false)
  const hoverEnterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardContainerRef = useRef<HTMLDivElement>(null)
  const [hoverAnchorRect, setHoverAnchorRect] = useState<DOMRect | null>(null)

  // Guard for post-unmount async operations
  const mountedRef = useRef(true)
  const swipeActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (swipeActionTimerRef.current) clearTimeout(swipeActionTimerRef.current)
    }
  }, [])

  // Track star changes for pulse animation
  const prevStarredRef = useRef(memo.isStarred)
  useEffect(() => {
    if (memo.isStarred !== prevStarredRef.current) {
      setStarPulse(true)
      const t = setTimeout(() => setStarPulse(false), 400)
      prevStarredRef.current = memo.isStarred
      return () => clearTimeout(t)
    }
  }, [memo.isStarred])

  const enterSelectionMode = useUIStore((s) => s.enterSelectionMode)

  // Hover preview handlers
  const handleMouseEnter = useCallback(() => {
    if (!isDesktop || isSelectionMode || isTrashView) return
    // isActive is derived after hooks, check at call time
    if (location.pathname === `/memo/${memo.id}`) return
    if (hoverLeaveTimer.current) { clearTimeout(hoverLeaveTimer.current); hoverLeaveTimer.current = null }
    hoverEnterTimer.current = setTimeout(() => {
      if (cardContainerRef.current) setHoverAnchorRect(cardContainerRef.current.getBoundingClientRect())
      setShowHoverPreview(true)
    }, 400)
  }, [isDesktop, isSelectionMode, isTrashView, location.pathname, memo.id])

  const handleMouseLeave = useCallback(() => {
    if (hoverEnterTimer.current) { clearTimeout(hoverEnterTimer.current); hoverEnterTimer.current = null }
    hoverLeaveTimer.current = setTimeout(() => setShowHoverPreview(false), 100)
  }, [])

  // Close preview on scroll
  useEffect(() => {
    if (!showHoverPreview) return
    const handleScroll = () => setShowHoverPreview(false)
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    return () => window.removeEventListener('scroll', handleScroll, { capture: true })
  }, [showHoverPreview])

  useEffect(() => {
    return () => {
      if (hoverEnterTimer.current) clearTimeout(hoverEnterTimer.current)
      if (hoverLeaveTimer.current) clearTimeout(hoverLeaveTimer.current)
    }
  }, [])

  const isSelected = memo.id != null && selectedMemoIds.includes(memo.id)
  const isActive = location.pathname === `/memo/${memo.id}`
  const isGrid = viewMode === 'grid'
  const pressOn = useGesture('menu')
  useLongPress(cardContainerRef, {
    enabled: pressOn && !isSelectionMode && memo.id != null,
    onPress: () => { if (memo.id != null) enterSelectionMode(memo.id) },
  })

  // Shared card actions — used by both swipe gestures and the hover/focus quick-action cluster
  const runSoftDelete = useCallback(() => {
    if (memo.id == null) return
    setIsDeleting(true)
    const memoId = memo.id
    swipeActionTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      try {
        const deleted = await softDelete(memoId)
        if (deleted) {
          pushUndo({ type: 'delete-memo', memos: [deleted], timestamp: Date.now() })
        }
      } catch (err) {
        console.error('Failed to delete memo:', err)
        if (mountedRef.current) {
          setIsDeleting(false)
          useToastStore.getState().showToast('메모를 지우지 못했어요. 다시 시도해 주세요', 'error')
        }
      }
    }, 300)
  }, [memo.id, softDelete, pushUndo])

  const runRestore = useCallback(() => {
    if (memo.id == null) return
    setIsDeleting(true)
    const memoId = memo.id
    swipeActionTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      await restore(memoId)
      useToastStore.getState().showToast('메모를 복원했어요', 'success')
    }, 300)
  }, [memo.id, restore])

  const runPermanentDelete = useCallback(() => {
    if (memo.id == null) return
    setIsDeleting(true)
    const memoId = memo.id
    swipeActionTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      await permanentDelete(memoId)
      useToastStore.getState().showToast('메모를 완전히 지웠어요', 'info')
    }, 300)
  }, [memo.id, permanentDelete])

  const handleClick = () => {
    if (!memo.id) return
    if (isSelectionMode) {
      toggleMemoSelection(memo.id)
    } else if (isTrashView) {
      // In trash view, tap enters selection mode instead of opening editor
      enterSelectionMode(memo.id)
    } else {
      navigateWithTransition(`/memo/${memo.id}`)
    }
  }

  // 밀기 · 길게 누르기 · ⋯ · 오른쪽 클릭이 모두 같은 목록을 써요. 선택은 길게 누르기와 같은 문이에요
  const actions: ItemAction[] = isTrashView
    ? [
        itemActions.done(runRestore, '복원'),
        { kind: 'delete', label: '완전히 지우기', icon: IcLineTrash, tone: 'danger', run: () => setPermanentAsk(true) },
        { label: '여러 개 고르기', icon: IcMwCheckCircle, run: () => { if (memo.id != null) enterSelectionMode(memo.id) } },
      ]
    : [
        itemActions.pin(() => { if (memo.id != null) void togglePin(memo.id) }, memo.isPinned),
        itemActions.delete(runSoftDelete),
        { label: memo.isStarred ? '중요 해제' : '중요 표시', icon: memo.isStarred ? IcMwStarFill : IcMwStar, run: () => { if (memo.id != null) void toggleStar(memo.id) } },
        { label: '슬라이드로 보기', icon: IcFillPlay, run: () => { if (memo.id != null) openSlideView(memo.id) } },
        { label: '여러 개 고르기', icon: IcMwCheckCircle, run: () => { if (memo.id != null) enterSelectionMode(memo.id) } },
      ]

  // PERF: Memoize expensive body text processing (regex + stripMarkdown + mask)
  const bodyText = useMemo(
    () => stripMarkdown(maskSensitiveData(memo.body.replace(/!\[.*?\]\(memo-image:\d+\)/g, '[이미지]'))),
    [memo.body]
  )

  // Drag & drop handler (desktop only)
  const handleDragStart = useCallback((e: React.DragEvent) => {
    if (!isDesktop || isSelectionMode || isTrashView || !memo.id) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData('application/memo-id', String(memo.id))
    e.dataTransfer.effectAllowed = 'move'
  }, [isDesktop, isSelectionMode, isTrashView, memo.id])

  return (
    <div
      ref={cardContainerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      draggable={isDesktop && !isSelectionMode && !isTrashView}
      onDragStart={handleDragStart}
      className={clsx('group relative h-full overflow-hidden rounded-2xl fold:rounded-xl', isDeleting && 'animate-card-shrink')}
    >
      <SortSlotContext.Provider value={OWN_PRESS}>
      <SwipeItem label={memo.title || '제목 없음'} actions={actions} hint={hint} more="none" swipe={!isGrid && !isSelectionMode} className="h-full">
      <div
        className={clsx(
          // Scoped transition list — never transition-all on list items (layout reflows must not animate)
          'memo-card relative flex w-full overflow-hidden rounded-2xl fold:rounded-xl text-left border border-[var(--card-hairline)] shadow-sm transition-[transform,box-shadow,border-color,background-color,filter] duration-200',
          'bg-[var(--surface-primary)]',
          isSelectionMode && 'hover:brightness-[0.97] dark:hover:brightness-110',
          // Hover stays neutral (shadow + hairline darkening) — accent is reserved for selected/active/starred
          !isSelectionMode && 'hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-950/[0.12] dark:hover:border-white/[0.16] active:scale-[0.98]',
          isSelected && 'ring-2 ring-primary-500',
          // UX-07: stronger active highlight
          isActive && 'lg:ring-1 lg:ring-primary-300 lg:dark:ring-primary-700 lg:bg-primary-50/50 lg:dark:bg-primary-900/10',
          isGrid ? 'h-full flex-col' : 'h-full flex-row gap-0',
          isRecent && digitalGardenEnabled && 'memo-glow-active'
        )}
        style={decayStyle}
      >
        {/* Stretched primary action (sibling of tag/quick-action buttons — no nested interactives) */}
        <Link
          to={`/memo/${memo.id}`}
          onClick={(e) => { e.preventDefault(); handleClick() }}
          draggable={false}
          aria-label={memo.title || '제목 없음'}
          className="memo-card__link absolute inset-0 z-[1] rounded-2xl fold:rounded-xl focus-visible:outline-offset-[-2px]"
        />
        {/* UX-14: Color bar — folder color */}
        {folder && (
          <div
            className={clsx(
              'shrink-0',
              isGrid ? 'h-[3px] w-full' : 'w-[3px]'
            )}
            style={{ backgroundColor: folder.color }}
          />
        )}

        <div className={clsx(
          'flex flex-1 flex-col min-w-0',
          isGrid ? 'gap-2 p-3' : 'gap-1.5 px-4 py-3.5'
        )}>
          {/* Title row */}
          <div className="flex items-start gap-2">
            {/* Width-animated so entering selection mode slides cards open instead of jumping */}
            <span
              aria-hidden={!isSelectionMode}
              className={clsx(
                'flex shrink-0 overflow-hidden transition-[width,opacity,transform,margin] duration-200 ease-out',
                // -mr-2 cancels the row's gap-2 while collapsed so the title stays flush with the body
                isSelectionMode ? 'w-7 opacity-100 scale-100 mr-0' : 'w-0 opacity-0 scale-50 -mr-2'
              )}
            >
              {isSelectionMode && (
                <IcMwCheckCircle size={20} className={clsx('mt-0.5 shrink-0 transition-colors', isSelected ? 'text-primary-500' : 'text-zinc-300 dark:text-zinc-600')} />
              )}
            </span>
            {/* A11Y-03: span instead of h3 inside button */}
            <span className={clsx(
              'flex-1 font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100',
              isGrid ? 'text-13 line-clamp-2' : 'text-sm fold:text-xs truncate'
            )}>
              <HighlightText text={memo.title || '제목 없음'} query={searchQuery} />
            </span>
            {memo.isPinned && (
              <IcLinePin size={16} className="shrink-0 text-primary-500 rotate-[-30deg]" />
            )}
            {memo.isStarred && (
              <IcMwStarFill size={16} className={clsx('shrink-0 text-primary-500', starPulse && 'animate-star-pulse')} />
            )}
            {/* 손짓 없이 여는 길: 이 메모의 메뉴예요 (넓은 화면은 아래 마우스 도구 줄이 맡아요) */}
            {!isDesktop && !isSelectionMode && <ItemMoreButton className="relative z-[2] -my-2.5 -mr-2 shrink-0" />}
          </div>

          {/* Body preview */}
          {memo.body && (
            <p className={clsx(
              'text-xs leading-relaxed text-zinc-500 dark:text-zinc-400',
              isGrid ? 'line-clamp-3' : 'line-clamp-2 fold:line-clamp-1'
            )}>
              <HighlightText text={bodyText} query={searchQuery} />
            </p>
          )}

          {/* 태그: 키트의 Tag예요. 눌리지 않는 표시라서 카드 어디를 눌러도 메모가 열려요 (태그로 거르기는 홈의 태그와 찾기에서 해요). */}
          {memo.tags.length > 0 && (
            <div className="flex max-h-6 flex-wrap items-center gap-1 overflow-hidden">
              {memo.tags.slice(0, isGrid ? 2 : 3).map((tag) => (
                <span key={tag} className="mw-tag mw-tag--category-basic mw-tag--large whitespace-nowrap">
                  #{tag}
                </span>
              ))}
              {memo.tags.length > (isGrid ? 2 : 3) && (
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  +{memo.tags.length - (isGrid ? 2 : 3)}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className={clsx(
            'flex items-center gap-1.5 text-xs tracking-[0.01em] tabular-nums text-zinc-500 dark:text-zinc-400',
            isGrid && 'mt-auto pt-1'
          )}>
            {folder && (
              <>
                <span className="truncate">{folder.name}</span>
                <span>·</span>
              </>
            )}
            <span className="shrink-0 inline-flex items-center gap-1">
              {memo.ephemeralExpiresAt && <IcMwFlame size={12} className="text-amber-500" />}
              {isTrashView && memo.deletedAt ? (
                <><IcLineTrash size={12} />{formatMemoDate(memo.deletedAt)}</>
              ) : (
                formatMemoDate(memo.updatedAt)
              )}
            </span>
          </div>
        </div>

        {/* Quick actions — hover/focus-reachable equivalent of the swipe gestures (desktop) */}
        {isDesktop && !isSelectionMode && (
          <div
            className={clsx(
              'absolute right-2 top-2 z-[2] flex items-center gap-0.5 rounded-lg border border-[var(--card-hairline)] bg-[var(--color-bg-elevated)]/95 p-0.5 shadow-sm',
              // pointer-events gated with visibility so the hidden cluster never blocks the card link
              'pointer-events-none opacity-0 transition-opacity duration-200',
              'group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
            )}
          >
            {isTrashView ? (
              <>
                <button
                  type="button"
                  onClick={runRestore}
                  aria-label="복원"
                  className="mw-icon-button"
                >
                  <IcLineUndo size={16} />
                </button>
                <button
                  type="button"
                  onClick={runPermanentDelete}
                  aria-label="완전히 지우기"
                  className="mw-icon-button"
                >
                  <IcLineTrash size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => toggleStar(memo.id!)}
                  aria-label={memo.isStarred ? '중요 해제' : '중요 표시'}
                  className="mw-icon-button"
                >
                  {memo.isStarred ? <IcMwStarFill size={16} className="text-primary-500" /> : <IcMwStar size={16} />}
                </button>
                <button
                  type="button"
                  onClick={runSoftDelete}
                  aria-label="지우기"
                  className="mw-icon-button"
                >
                  <IcLineTrash size={16} />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      </SwipeItem>
      </SortSlotContext.Provider>
      {showHoverPreview && hoverAnchorRect && (
        <MemoHoverPreview memo={memo} anchorRect={hoverAnchorRect} />
      )}

      <ConfirmDialog
        open={permanentAsk}
        onClose={() => setPermanentAsk(false)}
        onConfirm={() => { setPermanentAsk(false); runPermanentDelete() }}
        title="완전히 지울까요?"
        description="지운 메모는 되돌릴 수 없어요."
        confirmText="완전히 지우기"
        variant="danger"
      />
    </div>
  )
})
