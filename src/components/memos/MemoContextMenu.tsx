import { CheckCircle, LayoutGrid, LayoutList, ArrowUpDown } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useUIStore } from '@/stores/uiStore'
import type { SortBy } from '@/lib/types'

const SORT_LABELS: Record<SortBy, string> = {
  updatedAt: '수정 날짜순',
  createdAt: '생성 날짜순',
  title: '제목순',
}

const SORT_ORDER: SortBy[] = ['updatedAt', 'createdAt', 'title']

export function MemoContextMenu() {
  const isContextMenuOpen = useUIStore((s) => s.isContextMenuOpen)
  const closeContextMenu = useUIStore((s) => s.closeContextMenu)
  const toggleSelectionMode = useUIStore((s) => s.toggleSelectionMode)
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const sortBy = useUIStore((s) => s.sortBy)
  const setSortBy = useUIStore((s) => s.setSortBy)

  const handleSelectMode = () => {
    toggleSelectionMode()
    closeContextMenu()
  }

  const handleToggleView = () => {
    setViewMode(viewMode === 'list' ? 'grid' : 'list')
    closeContextMenu()
  }

  const handleCycleSort = () => {
    const currentIndex = SORT_ORDER.indexOf(sortBy)
    const nextIndex = (currentIndex + 1) % SORT_ORDER.length
    setSortBy(SORT_ORDER[nextIndex])
    closeContextMenu()
  }

  return (
    <BottomSheet isOpen={isContextMenuOpen} onClose={closeContextMenu}>
      <div className="flex flex-col -mx-5 -my-4">
        <button
          onClick={handleSelectMode}
          className="flex items-center gap-4 px-5 py-3.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
        >
          <CheckCircle className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          메모 선택
        </button>

        <button
          onClick={handleToggleView}
          className="flex items-center gap-4 px-5 py-3.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
        >
          {viewMode === 'list' ? (
            <LayoutGrid className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          ) : (
            <LayoutList className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          )}
          보기 방식
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
            {viewMode === 'list' ? '목록' : '그리드'}
          </span>
        </button>

        <button
          onClick={handleCycleSort}
          className="flex items-center gap-4 px-5 py-3.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:active:bg-zinc-700"
        >
          <ArrowUpDown className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
          정렬 기준
          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">
            {SORT_LABELS[sortBy]}
          </span>
        </button>
      </div>
    </BottomSheet>
  )
}
