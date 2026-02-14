import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Dialog, DialogHeader } from '@/components/ui/Dialog'
import { Checkbox } from '@/components/ui/Checkbox'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'

interface TaskPickerModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTaskIds: number[]
  onSave: (taskIds: number[]) => void
}

export function TaskPickerModal({ isOpen, onClose, selectedTaskIds, onSave }: TaskPickerModalProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const categories = useCategoryStore((s) => s.categories)
  const [selected, setSelected] = useState<Set<number>>(new Set(selectedTaskIds))
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState<number | null>(null)

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((t) => t.title.toLowerCase().includes(q))
    }
    if (filterCategory !== null) {
      result = result.filter((t) => t.categoryId === filterCategory)
    }
    return result.sort((a, b) => {
      if (a.status === 'pending' && b.status === 'completed') return -1
      if (a.status === 'completed' && b.status === 'pending') return 1
      return a.sortOrder - b.sortOrder
    })
  }, [tasks, search, filterCategory])

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleSave = () => {
    onSave(Array.from(selected))
    onClose()
  }

  const getCategoryName = (catId: number | null) => {
    if (catId === null) return ''
    return categories.find((c) => c.id === catId)?.name || ''
  }

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogHeader title="할일 선택" onClose={onClose} />
      <div className="space-y-3 mt-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="할일 검색..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterCategory(null)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterCategory === null
                ? 'bg-primary-500 text-white'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}
          >
            전체
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setFilterCategory(cat.id ?? null)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCategory === cat.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Task list */}
        <div className="max-h-72 overflow-y-auto space-y-1">
          {filteredTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => toggle(task.id!)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
            >
              <Checkbox
                checked={selected.has(task.id!)}
                onChange={() => toggle(task.id!)}
              />
              <div className="flex-1 min-w-0">
                <span
                  className={`text-sm block truncate ${
                    task.status === 'completed'
                      ? 'text-zinc-400 line-through'
                      : 'text-zinc-900 dark:text-zinc-100'
                  }`}
                >
                  {task.title}
                </span>
                {getCategoryName(task.categoryId) && (
                  <span className="text-[10px] text-zinc-400">{getCategoryName(task.categoryId)}</span>
                )}
              </div>
              {task.status === 'completed' && (
                <span className="text-[10px] text-green-500 flex-shrink-0">완료</span>
              )}
            </button>
          ))}
          {filteredTasks.length === 0 && (
            <p className="text-center text-sm text-zinc-400 py-8">할일이 없습니다.</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800">
          <span className="text-xs text-zinc-500">{selected.size}개 선택됨</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  )
}
