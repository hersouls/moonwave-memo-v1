import { parseISO, differenceInDays, endOfWeek, isToday as isTodayFn, isTomorrow as isTomorrowFn } from 'date-fns'
import { isOverdue } from './dateUtils'
import type { Task } from './types'

export interface TaskGroup {
  key: string
  label: string
  tasks: Task[]
  color?: string
}

type GroupKey = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'noDue' | 'completed'

const GROUP_META: Record<GroupKey, { label: string; color?: string }> = {
  overdue: { label: '기한 지남', color: 'text-red-500' },
  today: { label: '오늘', color: 'text-primary-600 dark:text-primary-400' },
  tomorrow: { label: '내일', color: 'text-amber-600 dark:text-amber-400' },
  thisWeek: { label: '이번 주', color: 'text-zinc-600 dark:text-zinc-400' },
  later: { label: '나중에', color: 'text-zinc-500 dark:text-zinc-500' },
  noDue: { label: '기한 없음', color: 'text-zinc-400 dark:text-zinc-500' },
  completed: { label: '완료됨', color: 'text-zinc-400 dark:text-zinc-500' },
}

function getGroupKey(task: Task): GroupKey {
  if (task.status === 'completed') return 'completed'
  if (!task.dueDate) return 'noDue'
  if (isOverdue(task.dueDate)) return 'overdue'

  const date = parseISO(task.dueDate)
  if (isTodayFn(date)) return 'today'
  if (isTomorrowFn(date)) return 'tomorrow'

  const today = new Date()
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 })
  if (differenceInDays(date, today) >= 0 && date <= weekEnd) return 'thisWeek'

  return 'later'
}

const GROUP_ORDER: GroupKey[] = ['overdue', 'today', 'tomorrow', 'thisWeek', 'later', 'noDue', 'completed']

export function groupTasksByDate(tasks: Task[]): TaskGroup[] {
  const buckets = new Map<GroupKey, Task[]>()

  for (const task of tasks) {
    const key = getGroupKey(task)
    const arr = buckets.get(key) ?? []
    arr.push(task)
    buckets.set(key, arr)
  }

  const groups: TaskGroup[] = []
  for (const key of GROUP_ORDER) {
    const groupTasks = buckets.get(key)
    if (groupTasks && groupTasks.length > 0) {
      const meta = GROUP_META[key]
      // Sort pending tasks by sortOrder, completed by completedAt desc
      if (key === 'completed') {
        groupTasks.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
      } else {
        groupTasks.sort((a, b) => a.sortOrder - b.sortOrder)
      }
      groups.push({
        key,
        label: meta.label,
        tasks: groupTasks,
        color: meta.color,
      })
    }
  }

  return groups
}
