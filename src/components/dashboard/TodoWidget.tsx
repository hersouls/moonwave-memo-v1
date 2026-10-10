import { useMemo } from 'react'
import { useMemoStore } from '@/stores/memoStore'
import { parseChecklist } from '@/utils/checklistParser'
import { WidgetCard } from './WidgetCard'
import { IcMwCheckSquare } from '@/mw/icons'
import { Link } from 'react-router-dom'

interface TodoItem {
  text: string
  memoId: number
  memoTitle: string
}

export function TodoWidget() {
  const memos = useMemoStore((s) => s.memos)

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
    <WidgetCard icon={IcMwCheckSquare} tint="primary" title={`할 일 ${uncheckedTodos.length}개`}>
      <ul className="space-y-2">
        {uncheckedTodos.map((todo, index) => (
          <li key={`${todo.memoId}-${index}`}>
            <Link
              to={`/memo/${todo.memoId}`}
              className="w-full text-left group flex items-start gap-2 py-3 px-1.5 -mx-1.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <span className="mt-1 w-3.5 h-3.5 shrink-0 rounded border border-zinc-300 dark:border-zinc-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">
                  {todo.text}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {todo.memoTitle}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </WidgetCard>
  )
}
