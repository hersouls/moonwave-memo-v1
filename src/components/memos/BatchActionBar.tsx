import { FolderInput, Trash2, Star, Pin, X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUndoStore } from '@/stores/undoStore'

export function BatchActionBar() {
  const selectedMemoIds = useUIStore((s) => s.selectedMemoIds)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const openFolderSelect = useUIStore((s) => s.openFolderSelect)
  const batchDelete = useMemoStore((s) => s.batchDelete)
  const batchStar = useMemoStore((s) => s.batchStar)
  const batchPin = useMemoStore((s) => s.batchPin)
  const memos = useMemoStore((s) => s.memos)
  const pushUndo = useUndoStore((s) => s.pushUndo)

  const count = selectedMemoIds.length

  if (count === 0) return null

  const handleMove = () => {
    openFolderSelect(null)
  }

  const handleDelete = async () => {
    const deleted = await batchDelete(selectedMemoIds)
    if (deleted.length > 0) {
      pushUndo({ type: 'delete-memos', memos: deleted, timestamp: Date.now() })
    }
    clearSelection()
  }

  const handleStar = async () => {
    const selectedMemos = memos.filter((m) => selectedMemoIds.includes(m.id!))
    const allStarred = selectedMemos.every((m) => m.isStarred)
    await batchStar(selectedMemoIds, !allStarred)
    clearSelection()
  }

  const handlePin = async () => {
    const selectedMemos = memos.filter((m) => selectedMemoIds.includes(m.id!))
    const allPinned = selectedMemos.every((m) => m.isPinned)
    await batchPin(selectedMemoIds, !allPinned)
    clearSelection()
  }

  const handleCancel = () => {
    clearSelection()
  }

  return (
    <div className="batch-action-bar fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 shadow-xl dark:bg-zinc-100 md:bottom-6">
      <span className="mr-1 text-xs font-medium text-white dark:text-zinc-900">
        {count}개 선택
      </span>

      <div className="mx-1 h-4 w-px bg-zinc-700 dark:bg-zinc-300" />

      <button
        onClick={handleMove}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white dark:text-zinc-600 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
        aria-label="이동"
      >
        <FolderInput className="h-4 w-4" />
        이동
      </button>

      <button
        onClick={handleDelete}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white dark:text-zinc-600 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
        aria-label="삭제"
      >
        <Trash2 className="h-4 w-4" />
        삭제
      </button>

      <button
        onClick={handleStar}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white dark:text-zinc-600 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
        aria-label="중요"
      >
        <Star className="h-4 w-4" />
        중요
      </button>

      <button
        onClick={handlePin}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white dark:text-zinc-600 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
        aria-label="고정"
      >
        <Pin className="h-4 w-4" />
        고정
      </button>

      <div className="mx-1 h-4 w-px bg-zinc-700 dark:bg-zinc-300" />

      <button
        onClick={handleCancel}
        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white dark:text-zinc-500 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
        aria-label="취소"
      >
        <X className="h-4 w-4" />
        취소
      </button>
    </div>
  )
}
