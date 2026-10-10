import { useState } from 'react'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUndoStore } from '@/stores/undoStore'
import { useToastStore } from '@/stores/toastStore'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { IcLineClose, IcLineFolder, IcLineLoading, IcLinePin, IcLineShare, IcLineTrash, IcLineUndo, IcMwSparkles, IcMwStar, IcMwTag } from '@/mw/icons'

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
  const batchRegenerateTitles = useMemoStore((s) => s.batchRegenerateTitles)
  const batchGenerateTags = useMemoStore((s) => s.batchGenerateTags)
  const permanentDelete = useMemoStore((s) => s.permanentDelete)
  const memos = useMemoStore((s) => s.memos)
  const pushUndo = useUndoStore((s) => s.pushUndo)

  const [isPermanentDeleteOpen, setIsPermanentDeleteOpen] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isTagging, setIsTagging] = useState(false)

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
      useToastStore.getState().showToast('클립보드에 복사했어요', 'success')
    }
    clearSelection()
  }

  const handleRestore = async () => {
    navigator.vibrate?.(20)
    await batchRestore(selectedMemoIds)
    useToastStore.getState().showToast(`메모 ${count}개를 복원했어요`, 'success')
    clearSelection()
  }

  const handlePermanentDelete = async () => {
    navigator.vibrate?.(20)
    for (const id of selectedMemoIds) {
      await permanentDelete(id)
    }
    useToastStore.getState().showToast(`메모 ${count}개를 완전히 지웠어요`, 'info')
    setIsPermanentDeleteOpen(false)
    clearSelection()
  }

  const handleRegenerateTitles = async () => {
    if (isRegenerating) return
    navigator.vibrate?.(20)
    setIsRegenerating(true)
    try {
      await batchRegenerateTitles(selectedMemoIds)
      useToastStore.getState().showToast(`메모 ${count}개의 제목을 다시 만들었어요`, 'success')
    } catch {
      useToastStore.getState().showToast('제목을 다시 만들지 못했어요. 다시 시도해 주세요', 'error')
    } finally {
      setIsRegenerating(false)
      clearSelection()
    }
  }

  const handleGenerateTags = async () => {
    if (isTagging) return
    navigator.vibrate?.(20)
    setIsTagging(true)
    try {
      const result = await batchGenerateTags(selectedMemoIds)
      const { showToast } = useToastStore.getState()
      const done = result.generated + result.recovered
      if (result.alreadyRunning) {
        showToast('이미 태그를 만들고 있어요', 'info')
      } else if (done > 0 && result.unprocessed > 0) {
        showToast(`메모 ${done}개에 태그를 만들었어요 (${result.unprocessed}개는 만들지 못했어요)`, 'success')
      } else if (done > 0) {
        showToast(`메모 ${done}개에 태그를 만들었어요`, 'success')
      } else if (result.unprocessed > 0) {
        if (result.aiUnavailable) {
          showToast('AI를 쓸 수 없어 태그를 만들지 못했어요. 설정에서 API 키를 등록해 주세요', 'warning')
        } else {
          showToast('AI 태그를 만들지 못했어요. 잠시 후 다시 시도해 주세요', 'error')
        }
      } else {
        showToast('고른 메모에 이미 태그가 있거나 태그를 만들 메모가 없어요', 'info')
      }
    } catch {
      useToastStore.getState().showToast('태그를 만들지 못했어요. 다시 시도해 주세요', 'error')
    } finally {
      setIsTagging(false)
      clearSelection()
    }
  }

  const handleCancel = () => {
    clearSelection()
  }

  // ≈40px touch targets — selection mode is entered via touch long-press
  // 고른 메모에 한꺼번에 하는 일: 키트의 버튼(Tertiary Subtle)이에요
  const btnClass = "mw-button mw-button--tertiary-subtle mw-button--medium shrink-0"

  return (
    <>
      <div className="batch-action-bar fixed top-16 left-1/2 z-40 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 sm:gap-2 rounded-2xl border border-[var(--border-secondary)] bg-[var(--surface-floating)] px-3 sm:px-4 py-2 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
        <span className="mr-1 min-w-[3ch] shrink-0 text-center text-xs font-medium tabular-nums text-[var(--text-primary)]">
          {count}개
        </span>

        <div className="mx-0.5 sm:mx-1 h-4 w-px shrink-0 bg-[var(--border-secondary)]" />

        {isTrashView ? (
          <>
            <button onClick={handleRestore} className={btnClass} aria-label="복원">
              <IcLineUndo size={16} />
              <span className="hidden sm:inline">복원</span>
            </button>

            <button type="button"
              onClick={() => setIsPermanentDeleteOpen(true)}
              className="mw-button mw-button--tertiary-subtle mw-button--medium shrink-0"
              aria-label="완전히 지우기"
            >
              <IcLineTrash size={16} />
              <span className="hidden sm:inline">완전히 지우기</span>
            </button>
          </>
        ) : (
          <>
            <button onClick={handleMove} className={btnClass} aria-label="이동">
              <IcLineFolder size={16} />
              <span className="hidden sm:inline">이동</span>
            </button>

            <button onClick={handleDelete} className={btnClass} aria-label="지우기">
              <IcLineTrash size={16} />
              <span className="hidden sm:inline">지우기</span>
            </button>

            <button onClick={handleStar} className={btnClass} aria-label="중요">
              <IcMwStar size={16} />
              <span className="hidden sm:inline">중요</span>
            </button>

            <button onClick={handlePin} className={btnClass} aria-label="고정">
              <IcLinePin size={16} />
              <span className="hidden sm:inline">고정</span>
            </button>

            <button
              onClick={handleRegenerateTitles}
              disabled={isRegenerating}
              className={btnClass + ' disabled:opacity-50'}
              aria-label="제목 재생성"
            >
              {isRegenerating ? (
                <IcLineLoading size={16} className="animate-spin" />
              ) : (
                <IcMwSparkles size={16} />
              )}
              <span className="hidden sm:inline">제목 재생성</span>
            </button>

            <button
              onClick={handleGenerateTags}
              disabled={isTagging}
              className={btnClass + ' disabled:opacity-50'}
              aria-label="태그 생성"
            >
              {isTagging ? (
                <IcLineLoading size={16} className="animate-spin" />
              ) : (
                <IcMwTag size={16} />
              )}
              <span className="hidden sm:inline">태그 생성</span>
            </button>

            {count === 1 && (
              <button onClick={handleShare} className={btnClass} aria-label="공유">
                <IcLineShare size={16} />
                <span className="hidden sm:inline">공유</span>
              </button>
            )}
          </>
        )}

        <div className="mx-0.5 sm:mx-1 h-4 w-px shrink-0 bg-[var(--border-secondary)]" />

        <button type="button"
          onClick={handleCancel}
          className="mw-button mw-button--tertiary-subtle mw-button--medium shrink-0"
          aria-label="취소"
        >
          <IcLineClose size={16} />
          <span className="hidden sm:inline">취소</span>
        </button>
      </div>

      <ConfirmDialog
        open={isPermanentDeleteOpen}
        onClose={() => setIsPermanentDeleteOpen(false)}
        onConfirm={handlePermanentDelete}
        title={`메모 ${count}개를 완전히 지울까요?`}
        description="지운 메모는 되돌릴 수 없어요."
        confirmText="완전히 지우기"
        variant="danger"
      />
    </>
  )
}
