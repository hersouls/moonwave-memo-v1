import type { Task } from '@/lib/types'
import { formatDueDate } from '@/lib/dateUtils'

/** Build a shareable text representation of a task */
function formatTaskForShare(task: Task): string {
  const lines: string[] = []
  lines.push(`${task.status === 'completed' ? '✅' : '📋'} ${task.title}`)

  if (task.dueDate) {
    lines.push(`📅 마감: ${formatDueDate(task.dueDate)}`)
  }
  if (task.priority !== 'none') {
    const label = { high: '높음', medium: '중간', low: '낮음' }[task.priority]
    lines.push(`🔔 우선순위: ${label}`)
  }
  if (task.subtasks.length > 0) {
    const done = task.subtasks.filter((s) => s.isCompleted).length
    lines.push(`📝 하위 작업: ${done}/${task.subtasks.length}`)
  }
  if (task.memo) {
    lines.push(`\n${task.memo}`)
  }
  return lines.join('\n')
}

export function useWebShare() {
  const isSupported = typeof navigator !== 'undefined' && !!navigator.share

  const shareTask = async (task: Task): Promise<boolean> => {
    const text = formatTaskForShare(task)

    if (isSupported) {
      try {
        await navigator.share({ title: task.title, text })
        return true
      } catch (err) {
        // User cancelled or not supported
        if ((err as Error).name === 'AbortError') return false
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  return { shareTask, isSupported }
}
