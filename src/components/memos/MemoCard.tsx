import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { Star, CheckCircle, Trash2, Pin, Flame, RotateCcw, MonitorPlay } from 'lucide-react'
import clsx from 'clsx'
import { ContextMenu } from '@/components/ui/ContextMenu'
import type { Memo, MemoColor } from '@/lib/types'
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

const MEMO_CARD_BG: Record<MemoColor, string> = {
  white: 'bg-white dark:bg-zinc-800',
  yellow: 'bg-amber-50 dark:bg-amber-950/30',
  green: 'bg-emerald-50 dark:bg-emerald-950/30',
  blue: 'bg-blue-50 dark:bg-blue-950/30',
  pink: 'bg-pink-50 dark:bg-pink-950/30',
  purple: 'bg-purple-50 dark:bg-purple-950/30',
}

// F-06: Dynamic swipe threshold for fold screens
function getSwipeThreshold() {
  return useUIStore.getState().isNarrowFold
    ? Math.round(window.innerWidth * 0.25)
    : 80
}
const LONG_PRESS_DURATION = 500
const isTouchDevice = typeof window !== 'undefined' && 'ontouchstart' in window

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
          <mark key={i} className="bg-primary-500/20 dark:bg-primary-400/25 text-inherit rounded-[3px] -mx-px px-px">
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
}

export const MemoCard = memo(function MemoCard({ memo, viewMode = 'list', isTrashView = false }: MemoCardProps) {
  const navigate = useNavigate()
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
  const setActiveTag = useUIStore((s) => s.setActiveTag)
  const defaultColor = useSettingsStore((s) => s.settings.memoSettings.defaultColor)
  const digitalGardenEnabled = useSettingsStore((s) => s.settings.livingWorkspace.digitalGardenEnabled)
  const toggleStar = useMemoStore((s) => s.toggleStar)
  const softDelete = useMemoStore((s) => s.softDelete)
  const restore = useMemoStore((s) => s.restore)
  const permanentDelete = useMemoStore((s) => s.permanentDelete)
  const pushUndo = useUndoStore((s) => s.pushUndo)

  const { style: decayStyle, isRecent } = useMemoryDecay(memo.updatedAt, digitalGardenEnabled)

  const isDesktop = useUIStore((s) => s.isDesktop)
  const openSlideView = useUIStore((s) => s.openSlideView)
  const [starPulse, setStarPulse] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null)

  // Hover preview state (desktop only)
  const [showHoverPreview, setShowHoverPreview] = useState(false)
  const hoverEnterTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoverLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cardContainerRef = useRef<HTMLDivElement>(null)
  const [hoverAnchorRect, setHoverAnchorRect] = useState<DOMRect | null>(null)

  // Swipe gesture state
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  // Commit-threshold crossing feedback (icon pop + haptic tick while finger is down)
  const [swipeCommitted, setSwipeCommitted] = useState(false)
  const swipeCommittedRef = useRef(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  // Long-press state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressed = useRef(false)
  const [isLongPressing, setIsLongPressing] = useState(false)

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

  if (!memo.id) return null

  const isSelected = selectedMemoIds.includes(memo.id)
  const isActive = location.pathname === `/memo/${memo.id}`
  const isGrid = viewMode === 'grid'

  // Haptic feedback with visual fallback for iOS (no Vibration API support)
  const hapticFeedback = useCallback((intensity: number = 30) => {
    if (navigator.vibrate) {
      navigator.vibrate(intensity)
    } else if (cardRef.current) {
      // Visual bounce fallback for iOS
      const el = cardRef.current
      el.style.transition = 'transform 0.15s ease, opacity 0.15s ease'
      el.style.transform = 'scale(0.95)'
      el.style.opacity = '0.7'
      setTimeout(() => { el.style.transform = ''; el.style.opacity = '' }, 150)
    }
  }, [])

  // Touch gesture handlers (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isTouchDevice || isSelectionMode) return
    const touch = e.touches[0]
    if (!touch) return
    // Ignore touches starting near screen edges (iOS Safari back/forward gesture zone)
    const startX = touch.clientX
    if (startX < 30 || startX > window.innerWidth - 30) return
    touchStartX.current = startX
    touchStartY.current = e.touches[0].clientY
    isLongPressed.current = false
    setIsSwiping(false)

    // Visual feedback timer (150ms)
    longPressFeedbackTimer.current = setTimeout(() => setIsLongPressing(true), 150)

    // Long-press: enter selection mode (Gmail pattern)
    longPressTimer.current = setTimeout(() => {
      if (memo.id) {
        enterSelectionMode(memo.id)
        hapticFeedback(30)
        isLongPressed.current = true
        setIsLongPressing(false)
      }
    }, LONG_PRESS_DURATION)
  }, [isSelectionMode, memo.id, enterSelectionMode])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTouchDevice || isSelectionMode) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Cancel long-press on any movement (5px threshold)
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current)
        longPressTimer.current = null
      }
      if (longPressFeedbackTimer.current) {
        clearTimeout(longPressFeedbackTimer.current)
        longPressFeedbackTimer.current = null
      }
      setIsLongPressing(false)
    }

    // Only swipe if horizontal movement > vertical
    if (!isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setIsSwiping(true)
      e.preventDefault() // Prevent iOS Safari back/forward gesture
    }

    if (isSwiping || Math.abs(dx) > 10) {
      setSwipeX(dx)
      if (isSwiping) e.preventDefault()

      // Haptic-style tick + icon pop the moment the swipe crosses the commit threshold
      const passed = Math.abs(dx) >= getSwipeThreshold()
      if (passed !== swipeCommittedRef.current) {
        swipeCommittedRef.current = passed
        setSwipeCommitted(passed)
        if (passed) navigator.vibrate?.(10)
      }
    }
  }, [isSelectionMode, isSwiping])

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
          useToastStore.getState().showToast('메모 삭제에 실패했습니다', 'error')
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
      useToastStore.getState().showToast('메모가 복원되었습니다', 'success')
    }, 300)
  }, [memo.id, restore])

  const runPermanentDelete = useCallback(() => {
    if (memo.id == null) return
    setIsDeleting(true)
    const memoId = memo.id
    swipeActionTimerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      await permanentDelete(memoId)
      useToastStore.getState().showToast('메모가 영구 삭제되었습니다', 'info')
    }, 300)
  }, [memo.id, permanentDelete])

  const handleTouchEnd = useCallback(async () => {
    if (!isTouchDevice || isSelectionMode) return

    // Cancel long-press timer
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    if (longPressFeedbackTimer.current) {
      clearTimeout(longPressFeedbackTimer.current)
      longPressFeedbackTimer.current = null
    }
    setIsLongPressing(false)

    const threshold = getSwipeThreshold()
    if (swipeX > threshold && memo.id) {
      hapticFeedback(15)
      if (isTrashView) {
        // Right swipe in trash → restore
        runRestore()
      } else {
        // Right swipe → toggle star
        toggleStar(memo.id)
      }
    } else if (swipeX < -threshold && memo.id) {
      hapticFeedback(25)
      if (isTrashView) {
        // Left swipe in trash → permanent delete
        runPermanentDelete()
      } else {
        // Left swipe → soft delete with shrink animation
        runSoftDelete()
      }
    }

    setSwipeX(0)
    setIsSwiping(false)
    swipeCommittedRef.current = false
    setSwipeCommitted(false)
    // Reset long-press flag after a tick to prevent click
    setTimeout(() => { isLongPressed.current = false }, 0)
  }, [swipeX, memo.id, isSelectionMode, toggleStar, isTrashView, runRestore, runPermanentDelete, runSoftDelete, hapticFeedback])

  const handleClick = () => {
    if (isSwiping || isLongPressed.current || !memo.id) return
    if (isSelectionMode) {
      toggleMemoSelection(memo.id)
    } else if (isTrashView) {
      // In trash view, tap enters selection mode instead of opening editor
      enterSelectionMode(memo.id)
    } else {
      navigateWithTransition(`/memo/${memo.id}`)
    }
  }

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
      className={clsx('group relative overflow-hidden rounded-2xl fold:rounded-xl', isDeleting && 'animate-card-shrink')}
    >
      {/* Swipe action backgrounds with progressive visual feedback */}
      {isTouchDevice && !isSelectionMode && (() => {
        const swipeProgress = Math.min(Math.abs(swipeX) / getSwipeThreshold(), 1)
        // Grows to 1.0 approaching the threshold, then pops to 1.3 at the commit point
        const iconScale = swipeCommitted ? 1.3 : 0.7 + swipeProgress * 0.3
        return (
          <>
            {/* Right swipe: star (normal) / restore (trash) */}
            <div
              className={clsx(
                'absolute inset-0 flex items-center pl-5 rounded-2xl transition-opacity',
                swipeX > 20 ? 'opacity-100' : 'opacity-0'
              )}
              style={{
                background: swipeX > 0
                  ? `linear-gradient(90deg, oklch(${isTrashView ? '0.65 0.17 145' : '0.78 0.18 70'} / ${swipeProgress * 0.9}), transparent 80%)`
                  : undefined,
              }}
            >
              {isTrashView ? (
                <RotateCcw
                  className="text-white transition-transform duration-150 ease-spring"
                  style={{ width: 20, height: 20, transform: `scale(${swipeX > 0 ? iconScale : 1})` }}
                />
              ) : (
                <Star
                  className="text-white fill-white transition-transform duration-150 ease-spring"
                  style={{ width: 20, height: 20, transform: `scale(${swipeX > 0 ? iconScale : 1})` }}
                />
              )}
            </div>
            {/* Left swipe: delete (normal) / permanent delete (trash) */}
            <div
              className={clsx(
                'absolute inset-0 flex items-center justify-end pr-5 rounded-2xl transition-opacity',
                swipeX < -20 ? 'opacity-100' : 'opacity-0'
              )}
              style={{
                background: swipeX < 0
                  ? `linear-gradient(270deg, oklch(0.58 0.22 25 / ${swipeProgress * 0.9}), transparent 80%)`
                  : undefined,
              }}
            >
              <Trash2
                className="text-white transition-transform duration-150 ease-spring"
                style={{ width: 20, height: 20, transform: `scale(${swipeX < 0 ? iconScale : 1})` }}
              />
            </div>
          </>
        )
      })()}

      <div
        ref={cardRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          // Scoped transition list — never transition-all on list items (layout reflows must not animate)
          'memo-card relative flex w-full overflow-hidden rounded-2xl fold:rounded-xl text-left border border-[var(--card-hairline)] shadow-sm transition-[transform,box-shadow,border-color,background-color,filter] duration-200',
          MEMO_CARD_BG[memo.color] || MEMO_CARD_BG[defaultColor] || 'bg-white dark:bg-zinc-800',
          // Selection-mode hover darkens in place so the memo's color identity survives
          isSelectionMode && 'hover:brightness-[0.97] dark:hover:brightness-110',
          // Hover stays neutral (shadow + hairline darkening) — accent is reserved for selected/active/starred
          !isSelectionMode && 'hover:shadow-md hover:-translate-y-0.5 hover:border-zinc-950/[0.12] dark:hover:border-white/[0.16] active:scale-[0.98]',
          isLongPressing && 'scale-[0.97] brightness-[0.95] dark:brightness-125',
          isSelected && 'ring-2 ring-primary-500',
          // UX-07: stronger active highlight
          isActive && 'lg:ring-1 lg:ring-primary-300 lg:dark:ring-primary-700 lg:bg-primary-50/50 lg:dark:bg-primary-900/10',
          isGrid ? 'flex-col' : 'flex-row gap-0',
          isRecent && digitalGardenEnabled && 'memo-glow-active'
        )}
        onContextMenu={(e) => {
          e.preventDefault()
          if (isDesktop && !isSelectionMode && !isTrashView && memo.id != null) {
            setCtxMenu({ x: e.clientX, y: e.clientY })
          }
        }}
        style={{
          touchAction: 'pan-y',
          ...decayStyle,
          transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined,
          // Spring snap-back on release (touch only — desktop keeps the class-scoped transition)
          ...(isTouchDevice
            ? { transition: isSwiping ? 'none' : 'transform 250ms var(--ease-spring)' }
            : {}),
        }}
      >
        {/* Stretched primary action (sibling of tag/quick-action buttons — no nested interactives) */}
        <button
          type="button"
          onClick={handleClick}
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
              <CheckCircle
                className={clsx(
                  'mt-0.5 h-5 w-5 shrink-0 transition-colors',
                  isSelected
                    ? 'fill-primary-500 text-primary-500'
                    : 'text-zinc-300 dark:text-zinc-600'
                )}
              />
            </span>
            {/* A11Y-03: span instead of h3 inside button */}
            <span className={clsx(
              'flex-1 font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100',
              isGrid ? 'text-[13px] line-clamp-2' : 'text-sm fold:text-xs truncate'
            )}>
              <HighlightText text={memo.title || '제목 없음'} query={searchQuery} />
            </span>
            {memo.isPinned && (
              <Pin className="h-3.5 w-3.5 shrink-0 text-primary-500 rotate-[-30deg]" />
            )}
            {memo.isStarred && (
              <Star className={clsx('h-4 w-4 shrink-0 fill-primary-500 text-primary-500', starPulse && 'animate-star-pulse')} />
            )}
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

          {/* Tags — true sibling buttons layered above the stretched card link */}
          {memo.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {memo.tags.slice(0, isGrid ? 2 : 3).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setActiveTag(tag)
                    useUIStore.getState().setSearchQuery('')
                    navigate('/memos')
                  }}
                  className="relative z-[2] inline-flex items-center px-2 py-1 text-[11px] font-medium rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-800/50 transition-colors cursor-pointer after:absolute after:-inset-y-2 after:-inset-x-1.5 after:content-['']"
                >
                  #{tag}
                </button>
              ))}
              {memo.tags.length > (isGrid ? 2 : 3) && (
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  +{memo.tags.length - (isGrid ? 2 : 3)}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className={clsx(
            'flex items-center gap-1.5 text-[11px] tracking-[0.01em] tabular-nums text-zinc-500 dark:text-zinc-400',
            isGrid && 'mt-auto pt-1'
          )}>
            {folder && (
              <>
                <span className="truncate">{folder.name}</span>
                <span>·</span>
              </>
            )}
            <span className="shrink-0 inline-flex items-center gap-1">
              {memo.ephemeralExpiresAt && <Flame className="h-3 w-3 text-amber-500" />}
              {isTrashView && memo.deletedAt ? (
                <><Trash2 className="h-3 w-3" />{formatMemoDate(memo.deletedAt)}</>
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
              'pointer-events-none opacity-0 transition-opacity duration-150',
              'group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100'
            )}
          >
            {isTrashView ? (
              <>
                <button
                  type="button"
                  onClick={runRestore}
                  aria-label="복원"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={runPermanentDelete}
                  aria-label="영구 삭제"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:text-zinc-400 dark:hover:bg-danger-900/30 dark:hover:text-danger-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => toggleStar(memo.id!)}
                  aria-label={memo.isStarred ? '중요 해제' : '중요 표시'}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
                >
                  <Star className={clsx('h-4 w-4', memo.isStarred && 'fill-primary-500 text-primary-500')} />
                </button>
                <button
                  type="button"
                  onClick={runSoftDelete}
                  aria-label="삭제"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:text-zinc-400 dark:hover:bg-danger-900/30 dark:hover:text-danger-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {showHoverPreview && hoverAnchorRect && (
        <MemoHoverPreview memo={memo} anchorRect={hoverAnchorRect} />
      )}

      {/* Right-click context menu — shared primitive (Esc/화살표 키/뷰포트 클램핑 내장) */}
      {ctxMenu && (
        <ContextMenu
          position={ctxMenu}
          items={[
            {
              label: '슬라이드로 보기',
              icon: MonitorPlay,
              onSelect: () => openSlideView(memo.id!),
            },
          ]}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
})
