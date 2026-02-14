import { CheckCircle, Trash2, FolderInput, X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useState } from 'react'

export function BatchActionBar() {
  const selectedTaskIds = useUIStore((s) => s.selectedTaskIds)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const toggleSelectionMode = useUIStore((s) => s.toggleSelectionMode)
  const batchComplete = useTaskStore((s) => s.batchComplete)
  const batchDelete = useTaskStore((s) => s.batchDelete)
  const batchMoveCategory = useTaskStore((s) => s.batchMoveCategory)
  const categories = useCategoryStore((s) => s.categories)
  const [showCategoryMenu, setShowCategoryMenu] = useState(false)

  const count = selectedTaskIds.size
  if (count === 0) return null

  const ids = Array.from(selectedTaskIds)

  const handleComplete = async () => {
    await batchComplete(ids)
    clearSelection()
    toggleSelectionMode()
  }

  const handleDelete = async () => {
    await batchDelete(ids)
    clearSelection()
    toggleSelectionMode()
  }

  const handleMoveCategory = async (categoryId: number | null) => {
    await batchMoveCategory(ids, categoryId)
    setShowCategoryMenu(false)
    clearSelection()
    toggleSelectionMode()
  }

  return (
    <div className="fixed bottom-20 lg:bottom-4 left-1/2 -translate-x-1/2 z-40 animate-[slideInFromBottom_0.2s_ease-out]">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-700">
        {/* Count */}
        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mr-2">
          {count}개 선택
        </span>

        {/* Complete */}
        <button
          type="button"
          onClick={handleComplete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          완료
        </button>

        {/* Move category */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCategoryMenu(!showCategoryMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
          >
            <FolderInput className="w-3.5 h-3.5" />
            이동
          </button>
          {showCategoryMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-40 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-lg py-1 z-50">
              <button
                type="button"
                onClick={() => handleMoveCategory(null)}
                className="w-full text-left px-3 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                미분류
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleMoveCategory(cat.id ?? null)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <span className="text-zinc-900 dark:text-zinc-100">{cat.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          삭제
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={() => {
            clearSelection()
            toggleSelectionMode()
          }}
          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
