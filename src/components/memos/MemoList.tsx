import { useState } from 'react'
import { MoreVertical, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { MemoCard } from './MemoCard'
import { MemoFilterTabs } from './MemoFilterTabs'
import { MemoSearchBar } from './MemoSearchBar'
import { MemoContextMenu } from './MemoContextMenu'
import { MemoEmptyState } from './MemoEmptyState'
import { BatchActionBar } from './BatchActionBar'
import { FAB } from '@/components/ui/FAB'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useMemoFilters } from '@/hooks/useMemoFilters'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'

export function MemoList() {
  const filteredMemos = useMemoFilters()
  const viewMode = useUIStore((s) => s.viewMode)
  const isSelectionMode = useUIStore((s) => s.isSelectionMode)
  const openContextMenu = useUIStore((s) => s.openContextMenu)
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const emptyTrash = useMemoStore((s) => s.emptyTrash)
  const getTrashFolder = useFolderStore((s) => s.getTrashFolder)

  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState(false)

  const trashFolder = getTrashFolder()
  const isTrashView = trashFolder != null && activeFolderId === trashFolder.id

  const handleEmptyTrash = async () => {
    await emptyTrash()
    setIsEmptyTrashOpen(false)
  }

  return (
    <div className="mx-auto w-full max-w-4xl lg:max-w-none lg:px-2">
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
              ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2'
              : 'flex flex-col gap-2.5'
          )}
        >
          {filteredMemos.map((memo) => (
            <MemoCard key={memo.id} memo={memo} viewMode={viewMode} />
          ))}
        </div>
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
