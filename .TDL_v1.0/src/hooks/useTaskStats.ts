import { useMemo } from 'react'
import { format, addDays, startOfWeek } from 'date-fns'
import type { Task, DailyCompletionData, CategoryBreakdown, Category } from '@/lib/types'

interface TaskStatsResult {
  completedCount: number
  pendingCount: number
  dailyCompletionData: DailyCompletionData[]
  categoryBreakdown: CategoryBreakdown[]
}

export function useTaskStats(
  tasks: Task[],
  categories: Category[],
  weekOffset: number = 0
): TaskStatsResult {
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === 'completed').length,
    [tasks]
  )

  const pendingCount = useMemo(
    () => tasks.filter((t) => t.status === 'pending').length,
    [tasks]
  )

  const dailyCompletionData = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(
      addDays(today, weekOffset * 7),
      { weekStartsOn: 0 }
    )

    return Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i)
      const dateStr = format(date, 'yyyy-MM-dd')
      const count = tasks.filter(
        (t) => t.status === 'completed' && t.completedAt?.startsWith(dateStr)
      ).length

      return { date: dateStr, count }
    })
  }, [tasks, weekOffset])

  const categoryBreakdown = useMemo(() => {
    const pendingTasks = tasks.filter((t) => t.status === 'pending')
    const categoryMap = new Map<number | null, number>()

    pendingTasks.forEach((task) => {
      const current = categoryMap.get(task.categoryId) ?? 0
      categoryMap.set(task.categoryId, current + 1)
    })

    const breakdown: CategoryBreakdown[] = []
    categoryMap.forEach((count, categoryId) => {
      const category = categories.find((c) => c.id === categoryId)
      breakdown.push({
        categoryId,
        categoryName: category?.name ?? '미분류',
        categoryColor: category?.color ?? '#a1a1aa',
        count,
      })
    })

    return breakdown.sort((a, b) => b.count - a.count)
  }, [tasks, categories])

  return {
    completedCount,
    pendingCount,
    dailyCompletionData,
    categoryBreakdown,
  }
}
