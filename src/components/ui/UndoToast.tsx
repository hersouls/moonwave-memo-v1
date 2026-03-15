import { useUndoStore } from '@/stores/undoStore'
import { useUIStore } from '@/stores/uiStore'
import { X } from 'lucide-react'

export function UndoToast() {
  const { current, isVisible, undo, dismiss } = useUndoStore()
  const isKeyboardOpen = useUIStore((s) => s.isKeyboardOpen)

  if (!isVisible || !current) return null

  const count = current.memos.length
  const message =
    count === 1 ? '메모가 삭제되었습니다' : `메모 ${count}개가 삭제되었습니다`

  return (
    <div
      className="fixed left-1/2 z-50 -translate-x-1/2 md:!bottom-8"
      style={{ bottom: isKeyboardOpen ? '1rem' : 'calc(env(safe-area-inset-bottom, 0px) + 5rem)' }}
    >
      <div className="flex items-center gap-3 rounded-lg bg-zinc-900 px-4 py-3 shadow-lg dark:bg-zinc-100">
        <span className="text-sm text-white dark:text-zinc-900">{message}</span>

        <button
          onClick={undo}
          className="whitespace-nowrap text-sm font-semibold text-primary-400 hover:text-primary-300 dark:text-primary-600 dark:hover:text-primary-700"
        >
          실행 취소
        </button>

        <button
          onClick={dismiss}
          className="ml-1 rounded-full p-0.5 text-zinc-400 hover:text-zinc-300 dark:text-zinc-500 dark:hover:text-zinc-600"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
