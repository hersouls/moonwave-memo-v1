import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckSquare } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { parseChecklist } from '@/utils/checklistParser'

interface TodoItem {
  text: string
  memoId: number
  memoTitle: string
}

export function TodoWidget() {
  const memos = useMemoStore((s) => s.memos)
  const navigate = useNavigate()

  const uncheckedTodos = useMemo(() => {
    const todos: TodoItem[] = []
    const activeMemos = memos.filter((m) => !m.deletedAt)

    for (const memo of activeMemos) {
      if (!memo.id) continue
      const items = parseChecklist(memo.body)
      for (const item of items) {
        if (!item.checked) {
          todos.push({
            text: item.text,
            memoId: memo.id,
            memoTitle: memo.title || '제목 없음',
          })
        }
      }
      if (todos.length >= 8) break
    }

    return todos.slice(0, 8)
  }, [memos])

  if (uncheckedTodos.length === 0) return null

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckSquare className="w-4 h-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {uncheckedTodos.length}개의 할 일
        </h3>
      </div>

      <ul className="space-y-2">
        {uncheckedTodos.map((todo, index) => (
          <li key={`${todo.memoId}-${index}`}>
            <button
              onClick={() => navigate(`/memo/${todo.memoId}`)}
              className="w-full text-left group flex items-start gap-2 py-1 px-1.5 -mx-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700/50 transition-colors"
            >
              <span className="mt-1 w-3.5 h-3.5 shrink-0 rounded border border-zinc-300 dark:border-zinc-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                  {todo.text}
                </p>
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">
                  {todo.memoTitle}
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
