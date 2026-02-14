import { addDays, addWeeks, addMonths, addYears, format } from 'date-fns'
import type { RepeatPattern, Task } from './types'

export function getNextOccurrence(dueDate: string, pattern: RepeatPattern): string | null {
  if (pattern.type === 'none') return null

  const date = new Date(dueDate)
  const interval = pattern.interval || 1

  let next: Date
  switch (pattern.type) {
    case 'daily':
      next = addDays(date, interval)
      break
    case 'weekly':
      next = addWeeks(date, interval)
      break
    case 'monthly':
      next = addMonths(date, interval)
      break
    case 'yearly':
      next = addYears(date, interval)
      break
    default:
      return null
  }

  if (pattern.endDate && format(next, 'yyyy-MM-dd') > pattern.endDate) {
    return null
  }

  return format(next, 'yyyy-MM-dd')
}

export function generateNextTask(task: Task): Partial<Task> | null {
  if (task.repeat.type === 'none' || !task.dueDate) return null

  const nextDate = getNextOccurrence(task.dueDate, task.repeat)
  if (!nextDate) return null

  return {
    title: task.title,
    categoryId: task.categoryId,
    status: 'pending',
    priority: task.priority,
    isFlagged: task.isFlagged,
    isStarred: task.isStarred,
    dueDate: nextDate,
    dueTime: task.dueTime,
    alarm: task.alarm ? { ...task.alarm } : { enabled: false },
    repeat: { ...task.repeat },
    memo: task.memo,
    subtasks: task.subtasks.map(st => ({ ...st, isCompleted: false })),
  }
}

export function getRepeatLabel(pattern: RepeatPattern): string {
  if (pattern.type === 'none') return '아니요'

  const interval = pattern.interval || 1
  switch (pattern.type) {
    case 'daily':
      return interval === 1 ? '매일' : `${interval}일마다`
    case 'weekly':
      return interval === 1 ? '매주' : `${interval}주마다`
    case 'monthly':
      return interval === 1 ? '매월' : `${interval}개월마다`
    case 'yearly':
      return interval === 1 ? '매년' : `${interval}년마다`
    default:
      return '아니요'
  }
}
