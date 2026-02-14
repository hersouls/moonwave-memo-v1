import { MoreVertical } from 'lucide-react'
import clsx from 'clsx'
import { MemoCard } from './MemoCard'
import { MemoFilterTabs } from './MemoFilterTabs'
import { MemoSearchBar } from './MemoSearchBar'
import { MemoContextMenu } from './MemoContextMenu'
import { MemoEmptyState } from './MemoEmptyState'
import { BatchActionBar } from './BatchActionBar'
import { FAB } from '@/components/ui/FAB'
import { useMemoFilters } from '@/hooks/useMemoFilters'
import { useUIStore } from '@/stores/uiStore'

export function MemoList() {
  const filteredMemos = useMemoFilters()
  const viewMode = useUIStore((s) => s.viewMode)
  const isSelectionMode = useUIStore((s) => s.isSelectionMode)
  const openContextMenu = useUIStore((s) => s.openContextMenu)

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Filter tabs + context menu button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <MemoFilterTabs />
        </div>
        <button
          onClick={openContextMenu}
          className="shrink-0 mr-4 rounded-full p-2 transition-colors hover:bg-zinc-100 active:bg-zinc-200 dark:hover:bg-zinc-800 dark:active:bg-zinc-700 lg:mr-0"
          aria-label="더보기 메뉴"
        >
          <MoreVertical className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      {/* Search bar */}
      <div className="mt-2">
        <MemoSearchBar />
      </div>

      {/* Memo list / grid */}
      {filteredMemos.length === 0 ? (
        <MemoEmptyState />
      ) : (
        <div
          className={clsx(
            'mt-3 px-4 pb-4 lg:px-0',
            viewMode === 'grid'
              ? 'grid grid-cols-2 gap-3 sm:grid-cols-3'
              : 'flex flex-col gap-2.5'
          )}
        >
          {filteredMemos.map((memo) => (
            <MemoCard key={memo.id} memo={memo} />
          ))}
        </div>
      )}

      {/* Selection mode bar */}
      {isSelectionMode && <BatchActionBar />}

      {/* FAB - hidden in selection mode */}
      {!isSelectionMode && <FAB />}

      {/* Context menu bottom sheet */}
      <MemoContextMenu />
    </div>
  )
}
