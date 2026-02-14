import { useUndoStore } from '@/stores/undoStore'
import { X } from 'lucide-react'

export function UndoToast() {
  const { current, isVisible, undo, dismiss } = useUndoStore()

  if (!isVisible || !current) return null

  const count = current.memos.length
  const message =
    count === 1 ? '메모가 삭제되었습니다' : `메모 ${count}개가 삭제되었습니다`

  return (
    <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 md:bottom-8">
      <div className="flex items-center gap-3 rounded-lg bg-gray-900 px-4 py-3 shadow-lg dark:bg-gray-100">
        <span className="text-sm text-white dark:text-gray-900">{message}</span>

        <button
          onClick={undo}
          className="whitespace-nowrap text-sm font-semibold text-primary-400 hover:text-primary-300 dark:text-primary-600 dark:hover:text-primary-700"
        >
          실행 취소
        </button>

        <button
          onClick={dismiss}
          className="ml-1 rounded-full p-0.5 text-gray-400 hover:text-gray-300 dark:text-gray-500 dark:hover:text-gray-600"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
