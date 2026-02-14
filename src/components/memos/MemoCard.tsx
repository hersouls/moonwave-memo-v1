import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Star, CheckCircle, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import type { Memo, MemoColor } from '@/lib/types'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUndoStore } from '@/stores/undoStore'
import { formatMemoDate } from '@/utils/format'

const MEMO_CARD_BG: Record<MemoColor, string> = {
  white: 'bg-white dark:bg-zinc-800',
  yellow: 'bg-amber-50 dark:bg-amber-950/30',
  green: 'bg-emerald-50 dark:bg-emerald-950/30',
  blue: 'bg-blue-50 dark:bg-blue-950/30',
  pink: 'bg-pink-50 dark:bg-pink-950/30',
  purple: 'bg-purple-50 dark:bg-purple-950/30',
}

const SWIPE_THRESHOLD = 80
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
          <mark key={i} className="bg-primary-200 dark:bg-primary-800/40 text-inherit rounded-sm px-0.5">
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
}

export function MemoCard({ memo, viewMode = 'list' }: MemoCardProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const folders = useFolderStore((s) => s.folders)
  const isSelectionMode = useUIStore((s) => s.isSelectionMode)
  const selectedMemoIds = useUIStore((s) => s.selectedMemoIds)
  const toggleMemoSelection = useUIStore((s) => s.toggleMemoSelection)
  const searchQuery = useUIStore((s) => s.searchQuery)
  const toggleStar = useMemoStore((s) => s.toggleStar)
  const softDelete = useMemoStore((s) => s.softDelete)
  const pushUndo = useUndoStore((s) => s.pushUndo)

  const folder = memo.folderId != null
    ? folders.find((f) => f.id === memo.folderId)
    : null

  const isSelected = selectedMemoIds.includes(memo.id!)
  const isActive = location.pathname === `/memo/${memo.id}`
  const isGrid = viewMode === 'grid'
  const [starPulse, setStarPulse] = useState(false)

  // Swipe gesture state
  const [swipeX, setSwipeX] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const cardRef = useRef<HTMLButtonElement>(null)

  // Track star changes for pulse animation
  const prevStarred = useState(memo.isStarred)[0]
  useEffect(() => {
    if (memo.isStarred !== prevStarred) {
      setStarPulse(true)
      const t = setTimeout(() => setStarPulse(false), 400)
      return () => clearTimeout(t)
    }
  }, [memo.isStarred, prevStarred])

  // Touch gesture handlers (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isTouchDevice || isSelectionMode) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    setIsSwiping(false)
  }, [isSelectionMode])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isTouchDevice || isSelectionMode) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Only swipe if horizontal movement > vertical
    if (!isSwiping && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      setIsSwiping(true)
    }

    if (isSwiping || Math.abs(dx) > 10) {
      setSwipeX(dx)
    }
  }, [isSelectionMode, isSwiping])

  const handleTouchEnd = useCallback(async () => {
    if (!isTouchDevice || isSelectionMode) return

    if (swipeX > SWIPE_THRESHOLD && memo.id) {
      // Right swipe → toggle star
      toggleStar(memo.id)
    } else if (swipeX < -SWIPE_THRESHOLD && memo.id) {
      // Left swipe → delete
      const deleted = await softDelete(memo.id)
      if (deleted) {
        pushUndo({ type: 'delete-memo', memos: [deleted], timestamp: Date.now() })
      }
    }

    setSwipeX(0)
    setIsSwiping(false)
  }, [swipeX, memo.id, isSelectionMode, toggleStar, softDelete, pushUndo])

  const handleClick = () => {
    if (isSwiping) return
    if (isSelectionMode) {
      toggleMemoSelection(memo.id!)
    } else {
      navigate(`/memo/${memo.id}`)
    }
  }

  const bodyText = memo.body.replace(/!\[.*?\]\(memo-image:\d+\)/g, '[이미지]')

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Swipe action backgrounds */}
      {isTouchDevice && !isSelectionMode && (
        <>
          {/* Right swipe: star */}
          <div className={clsx(
            'absolute inset-0 flex items-center pl-5 rounded-2xl bg-amber-500 transition-opacity',
            swipeX > 20 ? 'opacity-100' : 'opacity-0'
          )}>
            <Star className="h-5 w-5 text-white fill-white" />
          </div>
          {/* Left swipe: delete */}
          <div className={clsx(
            'absolute inset-0 flex items-center justify-end pr-5 rounded-2xl bg-red-500 transition-opacity',
            swipeX < -20 ? 'opacity-100' : 'opacity-0'
          )}>
            <Trash2 className="h-5 w-5 text-white" />
          </div>
        </>
      )}

      <button
        ref={cardRef}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={clsx(
          'memo-card relative flex w-full overflow-hidden rounded-2xl text-left shadow-sm transition-all duration-200',
          MEMO_CARD_BG[memo.color] || 'bg-white dark:bg-zinc-800',
          isSelectionMode && 'hover:bg-zinc-50 dark:hover:bg-zinc-750',
          !isSelectionMode && 'hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]',
          isSelected && 'ring-2 ring-primary-500',
          isActive && 'lg:ring-2 lg:ring-primary-500 lg:bg-primary-50 lg:dark:bg-primary-900/20',
          isGrid ? 'flex-col' : 'flex-row gap-0'
        )}
        style={{
          transform: swipeX !== 0 ? `translateX(${swipeX}px)` : undefined,
          transition: isSwiping ? 'none' : 'transform 0.2s ease',
        }}
      >
        {/* Color bar: top for grid, left for list */}
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
            <h3 className={clsx(
              'flex-1 font-bold text-zinc-900 dark:text-zinc-100',
              isGrid ? 'text-xs line-clamp-2' : 'text-sm truncate'
            )}>
              <HighlightText text={memo.title || '제목 없음'} query={searchQuery} />
            </h3>
            {memo.isStarred && (
              <Star className={clsx('h-4 w-4 shrink-0 fill-primary-500 text-primary-500', starPulse && 'animate-star-pulse')} />
            )}
          </div>

          {/* Body preview */}
          {memo.body && (
            <p className={clsx(
              'text-xs leading-relaxed text-zinc-500 dark:text-zinc-400',
              isGrid ? 'line-clamp-3' : 'line-clamp-2'
            )}>
              <HighlightText text={bodyText} query={searchQuery} />
            </p>
          )}

          {/* Footer */}
          <div className={clsx(
            'flex items-center gap-1.5 text-zinc-400 dark:text-zinc-500',
            isGrid ? 'text-[10px] mt-auto pt-1' : 'text-[11px]'
          )}>
            {folder && (
              <>
                <span className="truncate">{folder.name}</span>
                <span>·</span>
              </>
            )}
            <span className="shrink-0">{formatMemoDate(memo.updatedAt)}</span>
            {memo.isPinned && (
              <>
                <span>·</span>
                <span className="shrink-0 text-primary-500">고정됨</span>
              </>
            )}
          </div>
        </div>
      </button>
    </div>
  )
}
