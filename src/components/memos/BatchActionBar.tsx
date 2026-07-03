import { useState } from 'react'
import { FolderInput, Trash2, Star, Pin, X, Share2, RotateCcw } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUndoStore } from '@/stores/undoStore'
import { useToastStore } from '@/stores/toastStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

interface BatchActionBarProps {
  isTrashView?: boolean
}

export function BatchActionBar({ isTrashView = false }: BatchActionBarProps) {
  const selectedMemoIds = useUIStore((s) => s.selectedMemoIds)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const openFolderSelect = useUIStore((s) => s.openFolderSelect)
  const batchDelete = useMemoStore((s) => s.batchDelete)
  const batchStar = useMemoStore((s) => s.batchStar)
  const batchPin = useMemoStore((s) => s.batchPin)
  const batchRestore = useMemoStore((s) => s.batchRestore)
  const permanentDelete = useMemoStore((s) => s.permanentDelete)
  const memos = useMemoStore((s) => s.memos)
  const pushUndo = useUndoStore((s) => s.pushUndo)

  const [isPermanentDeleteOpen, setIsPermanentDeleteOpen] = useState(false)

  const count = selectedMemoIds.length

  if (count === 0) return null

  const handleMove = () => {
    openFolderSelect(null)
  }

  const handleDelete = async () => {
    navigator.vibrate?.(20)
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

  const handleShare = async () => {
    if (count !== 1) return
    const memo = memos.find((m) => m.id === selectedMemoIds[0])
    if (!memo) return
    const { shareMemo } = await import('@/utils/share')
    const result = await shareMemo({
      title: memo.title,
      body: memo.body,
      url: `${window.location.origin}/memo/${memo.id}`,
    })
    if (result === 'copied') {
      useToastStore.getState().showToast('클립보드에 복사되었습니다', 'success')
    }
    clearSelection()
  }

  const handleRestore = async () => {
    navigator.vibrate?.(20)
    await batchRestore(selectedMemoIds)
    useToastStore.getState().showToast(`${count}개 메모가 복원되었습니다`, 'success')
    clearSelection()
  }

  const handlePermanentDelete = async () => {
    navigator.vibrate?.(20)
    for (const id of selectedMemoIds) {
      await permanentDelete(id)
    }
    useToastStore.getState().showToast(`${count}개 메모가 영구 삭제되었습니다`, 'info')
    setIsPermanentDeleteOpen(false)
    clearSelection()
  }

  const handleCancel = () => {
    clearSelection()
  }

  // ≈40px touch targets — selection mode is entered via touch long-press
  const btnClass = "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white dark:text-zinc-600 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"

  return (
    <>
      <div className="batch-action-bar fixed top-16 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 sm:gap-2 rounded-2xl bg-zinc-900 px-3 sm:px-4 py-2 shadow-xl dark:bg-zinc-100 animate-in fade-in slide-in-from-top-2 duration-200">
        <span className="mr-1 min-w-[3ch] shrink-0 text-center text-xs font-medium tabular-nums text-white dark:text-zinc-900">
          {count}개
        </span>

        <div className="mx-0.5 sm:mx-1 h-4 w-px shrink-0 bg-zinc-700 dark:bg-zinc-300" />

        {isTrashView ? (
          <>
            <button onClick={handleRestore} className={btnClass} aria-label="복원">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">복원</span>
            </button>

            <button
              onClick={() => setIsPermanentDeleteOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/30 hover:text-red-300 dark:text-red-500 dark:hover:bg-red-100 dark:hover:text-red-700"
              aria-label="영구 삭제"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">영구 삭제</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={handleMove} className={btnClass} aria-label="이동">
              <FolderInput className="h-4 w-4" />
              <span className="hidden sm:inline">이동</span>
            </button>

            <button onClick={handleDelete} className={btnClass} aria-label="삭제">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">삭제</span>
            </button>

            <button onClick={handleStar} className={btnClass} aria-label="중요">
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">중요</span>
            </button>

            <button onClick={handlePin} className={btnClass} aria-label="고정">
              <Pin className="h-4 w-4" />
              <span className="hidden sm:inline">고정</span>
            </button>

            {count === 1 && (
              <button onClick={handleShare} className={btnClass} aria-label="공유">
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">공유</span>
              </button>
            )}
          </>
        )}

        <div className="mx-0.5 sm:mx-1 h-4 w-px shrink-0 bg-zinc-700 dark:bg-zinc-300" />

        <button
          onClick={handleCancel}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-2.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white dark:text-zinc-500 dark:hover:bg-zinc-200 dark:hover:text-zinc-900"
          aria-label="취소"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">취소</span>
        </button>
      </div>

      <ConfirmDialog
        open={isPermanentDeleteOpen}
        onClose={() => setIsPermanentDeleteOpen(false)}
        onConfirm={handlePermanentDelete}
        title="영구 삭제"
        description={`선택한 ${count}개 메모를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.`}
        confirmText="영구 삭제"
        variant="danger"
      />
    </>
  )
}
