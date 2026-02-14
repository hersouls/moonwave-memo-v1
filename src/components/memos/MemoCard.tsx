import { useNavigate, useLocation } from 'react-router-dom'
import { Star, CheckCircle } from 'lucide-react'
import clsx from 'clsx'
import type { Memo } from '@/lib/types'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import { formatMemoDate } from '@/utils/format'

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

  const folder = memo.folderId != null
    ? folders.find((f) => f.id === memo.folderId)
    : null

  const isSelected = selectedMemoIds.includes(memo.id!)
  const isActive = location.pathname === `/memo/${memo.id}`
  const isGrid = viewMode === 'grid'

  const handleClick = () => {
    if (isSelectionMode) {
      toggleMemoSelection(memo.id!)
    } else {
      navigate(`/memo/${memo.id}`)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={clsx(
        'memo-card relative flex w-full overflow-hidden rounded-2xl bg-white text-left shadow-sm transition-all dark:bg-zinc-800',
        isSelectionMode && 'hover:bg-zinc-50 dark:hover:bg-zinc-750',
        !isSelectionMode && 'hover:shadow-md active:scale-[0.99]',
        isSelected && 'ring-2 ring-primary-500',
        isActive && 'lg:ring-2 lg:ring-primary-500 lg:bg-primary-50 lg:dark:bg-primary-900/20',
        isGrid ? 'flex-col' : 'flex-row gap-0'
      )}
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
            {memo.title || '제목 없음'}
          </h3>
          {memo.isStarred && (
            <Star className="h-4 w-4 shrink-0 fill-primary-500 text-primary-500" />
          )}
        </div>

        {/* Body preview */}
        {memo.body && (
          <p className={clsx(
            'text-xs leading-relaxed text-zinc-500 dark:text-zinc-400',
            isGrid ? 'line-clamp-3' : 'line-clamp-2'
          )}>
            {memo.body}
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
  )
}
