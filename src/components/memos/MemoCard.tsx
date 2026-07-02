import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { createPortal } from 'react-dom'
import { Star, CheckCircle, Trash2, Pin, Flame, RotateCcw, MonitorPlay } from 'lucide-react'
import clsx from 'clsx'
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
          <mark key={i} className="bg-yellow-300/80 dark:bg-yellow-500/40 text-inherit rounded-sm px-0.5 ring-1 ring-yellow-400/50 dark:ring-yellow-500/30">
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
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const cardRef = useRef<HTMLButtonElement>(null)

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

  // Close context menu on Escape
  useEffect(() => {
    if (!ctxMenu) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setCtxMenu(null); e.stopPropagation() }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [ctxMenu])

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
    }
  }, [isSelectionMode, isSwiping])

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
        setIsDeleting(true)
        const memoId = memo.id
        swipeActionTimerRef.current = setTimeout(async () => {
          if (!mountedRef.current) return
          await restore(memoId)
          useToastStore.getState().showToast('메모가 복원되었습니다', 'success')
        }, 300)
      } else {
        // Right swipe → toggle star
        toggleStar(memo.id)
      }
    } else if (swipeX < -threshold && memo.id) {
      hapticFeedback(25)
      if (isTrashView) {
        // Left swipe in trash → permanent delete
        setIsDeleting(true)
        const memoId = memo.id
        swipeActionTimerRef.current = setTimeout(async () => {
          if (!mountedRef.current) return
          await permanentDelete(memoId)
          useToastStore.getState().showToast('메모가 영구 삭제되었습니다', 'info')
        }, 300)
      } else {
        // Left swipe → soft delete with shrink animation
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
      }
    }

    setSwipeX(0)
    setIsSwiping(false)
    // Reset long-press flag after a tick to prevent click
    setTimeout(() => { isLongPressed.current = false }, 0)
  }, [swipeX, memo.id, isSelectionMode, toggleStar, softDelete, pushUndo, isTrashView, restore, permanentDelete])

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
      className={clsx('relative overflow-hidden rounded-2xl fold:rounded-xl', isDeleting && 'animate-card-shrink')}
    >
      {/* Swipe action backgrounds with progressive visual feedback */}
      {isTouchDevice && !isSelectionMode && (() => {
        const swipeProgress = Math.min(Math.abs(swipeX) / getSwipeThreshold(), 1)
        const iconScale = 0.8 + swipeProgress * 0.6
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
                  className="text-white transition-transform"
                  style={{ width: 20, height: 20, transform: `scale(${swipeX > 0 ? iconScale : 1})` }}
                />
              ) : (
                <Star
                  className="text-white fill-white transition-transform"
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
                className="text-white transition-transform"
                style={{ width: 20, height: 20, transform: `scale(${swipeX < 0 ? iconScale : 1})` }}
              />
            </div>
          </>
        )
      })()}

      <button
        ref={cardRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          'memo-card relative flex w-full overflow-hidden rounded-2xl fold:rounded-xl text-left border border-zinc-950/[0.06] dark:border-white/[0.07] shadow-sm transition-all duration-200',
          MEMO_CARD_BG[memo.color] || MEMO_CARD_BG[defaultColor] || 'bg-white dark:bg-zinc-800',
          isSelectionMode && 'hover:bg-zinc-50 dark:hover:bg-zinc-700',
          !isSelectionMode && 'hover:shadow-md hover:-translate-y-0.5 hover:border-primary-200/70 dark:hover:border-primary-800/40 active:scale-[0.98]',
          isLongPressing && 'scale-[0.97] bg-zinc-100 dark:bg-zinc-700/50',
          isSelected && 'ring-2 ring-primary-500',
          // UX-07: stronger active highlight
          isActive && 'lg:ring-1 lg:ring-primary-300 lg:dark:ring-primary-700 lg:bg-primary-50/50 lg:dark:bg-primary-900/10',
          isGrid ? 'flex-col' : 'flex-row gap-0',
          isRecent && digitalGardenEnabled && 'memo-glow-active'
        )}
        onContextMenu={(e) => {
          e.preventDefault()
          if (isDesktop && !isSelectionMode && !isTrashView && memo.id != null) {
            const x = Math.min(e.clientX, window.innerWidth - 200)
            const y = Math.min(e.clientY, window.innerHeight - 60)
            setCtxMenu({ x, y })
          }
        }}
        style={{
          touchAction: 'pan-y',
          ...decayStyle,
          transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined,
          transition: isSwiping ? 'none' : 'transform 0.2s ease',
        }}
      >
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
            {isSelectionMode && (
              <CheckCircle
                className={clsx(
                  'mt-0.5 h-5 w-5 shrink-0 transition-colors',
                  isSelected
                    ? 'fill-primary-500 text-primary-500'
                    : 'text-zinc-300 dark:text-zinc-600'
                )}
              />
            )}
            {/* A11Y-03: span instead of h3 inside button */}
            <span className={clsx(
              'flex-1 font-bold text-zinc-900 dark:text-zinc-100',
              isGrid ? 'text-xs line-clamp-2' : 'text-sm fold:text-xs truncate'
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

          {/* Tags */}
          {memo.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1">
              {memo.tags.slice(0, isGrid ? 2 : 3).map((tag) => (
                <span
                  key={tag}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveTag(tag)
                    useUIStore.getState().setSearchQuery('')
                    navigate('/memos')
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      setActiveTag(tag)
                      useUIStore.getState().setSearchQuery('')
                      navigate('/memos')
                    }
                  }}
                  className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-primary-50 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-800/50 transition-colors cursor-pointer"
                >
                  #{tag}
                </span>
              ))}
              {memo.tags.length > (isGrid ? 2 : 3) && (
                <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                  +{memo.tags.length - (isGrid ? 2 : 3)}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className={clsx(
            'flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400',
            isGrid ? 'text-[10px] mt-auto pt-1' : 'text-[11px]'
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
      </button>
      {showHoverPreview && hoverAnchorRect && (
        <MemoHoverPreview memo={memo} anchorRect={hoverAnchorRect} />
      )}

      {/* Right-click context menu */}
      {ctxMenu && createPortal(
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setCtxMenu(null)} onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null) }} />
          <div
            className="fixed z-[71] min-w-[180px] bg-white dark:bg-zinc-800 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-700 py-1.5 animate-in fade-in zoom-in-95 duration-150"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
          >
            <button
              onClick={() => { openSlideView(memo.id!); setCtxMenu(null) }}
              className="ctx-menu__item w-full"
            >
              <MonitorPlay className="ctx-menu__item-icon" />
              슬라이드로 보기
            </button>
          </div>
        </>,
        document.body
      )}
    </div>
  )
})
