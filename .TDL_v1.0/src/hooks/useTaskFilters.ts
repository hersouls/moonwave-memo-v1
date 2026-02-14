import { useMemo } from 'react'
import type { Task, Category, TaskStatus } from '@/lib/types'

interface TaskFilterOptions {
  categoryId?: number | null
  categories?: Category[]
  status?: TaskStatus
  searchQuery?: string
}

export function useTaskFilters(tasks: Task[], options: TaskFilterOptions) {
  const { categoryId, categories, status, searchQuery } = options

  const filteredTasks = useMemo(() => {
    let result = tasks

    // Filter by category (include children)
    if (categoryId !== undefined && categoryId !== null) {
      const childIds = categories
        ?.filter(c => c.parentId === categoryId)
        .map(c => c.id) || []

      const targetIds = new Set([categoryId, ...childIds])

      result = result.filter((task) =>
        task.categoryId !== null && targetIds.has(task.categoryId)
      )
    }

    // Filter by status
    if (status) {
      result = result.filter((task) => task.status === status)
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase()
      result = result.filter(
        (task) =>
          task.title.toLowerCase().includes(query) ||
          task.memo?.toLowerCase().includes(query) ||
          task.subtasks.some((st) => st.title.toLowerCase().includes(query))
      )
    }

    return result
  }, [tasks, categoryId, status, searchQuery])

  return filteredTasks
}
