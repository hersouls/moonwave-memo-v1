import { format, isToday as isTodayFn, parseISO, differenceInDays, startOfWeek, endOfWeek, addDays, startOfDay } from 'date-fns'

export function isOverdue(dueDate?: string): boolean {
  if (!dueDate) return false
  const today = new Date().toISOString().split('T')[0]
  return dueDate < today
}

export function isDueToday(dueDate?: string): boolean {
  if (!dueDate) return false
  return isTodayFn(parseISO(dueDate))
}

export function formatDueDate(dueDate: string): string {
  const date = parseISO(dueDate)
  const today = startOfDay(new Date())
  const diff = differenceInDays(date, today)

  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'

  const year = date.getFullYear()
  const currentYear = today.getFullYear()

  if (year === currentYear) {
    return format(date, 'MM-dd')
  }
  return format(date, 'yyyy-MM-dd')
}

export function formatDueDateWithTime(dueDate: string, dueTime?: string): string {
  const dateStr = formatDueDate(dueDate)
  if (!dueTime) return dateStr

  const [hours, minutes] = dueTime.split(':').map(Number)
  const period = hours < 12 ? '오전' : '오후'
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  return `${dateStr} ${period} ${String(displayHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function formatRelativeDate(dateStr: string): string {
  const date = parseISO(dateStr)
  const now = new Date()
  const diff = differenceInDays(now, date)

  if (diff === 0) return '오늘'
  if (diff === 1) return '어제'
  if (diff < 7) return `${diff}일 전`
  if (diff < 30) return `${Math.floor(diff / 7)}주 전`
  return format(date, 'yyyy-MM-dd')
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  const start = startOfWeek(date, { weekStartsOn: 0 }) // Sunday
  const end = endOfWeek(date, { weekStartsOn: 0 })
  return { start, end }
}

export function getWeekDates(date: Date): Date[] {
  const { start } = getWeekRange(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function formatWeekRange(date: Date): string {
  const { start, end } = getWeekRange(date)
  return `${format(start, 'M/d')}-${format(end, 'M/d')}`
}

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

export function formatStreak(days: number): string {
  return `${days}일 동안 계획을 지켰습니다!`
}

export function formatCalendarDateLabel(dateStr: string): string {
  const date = parseISO(dateStr)
  const today = new Date()
  const diff = differenceInDays(date, today)

  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === -1) return '어제'

  return date.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}
