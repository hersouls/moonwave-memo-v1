import { differenceInDays, parseISO } from 'date-fns'

/** Returns number of days overdue (0 = not overdue) */
export function getOverdueDays(dueDate?: string): number {
  if (!dueDate) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = parseISO(dueDate)
  const diff = differenceInDays(today, due)
  return diff > 0 ? diff : 0
}

/** Format overdue badge text: "D+1", "D+7", etc. */
export function formatOverdueBadge(dueDate?: string): string | null {
  const days = getOverdueDays(dueDate)
  if (days <= 0) return null
  return `D+${days}`
}
