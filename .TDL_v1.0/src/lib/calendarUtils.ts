import {
  startOfMonth, startOfWeek,
  addDays, addMonths, subMonths,
  format, isSameMonth, isToday, getDay
} from 'date-fns'

export interface CalendarDay {
  date: Date
  dateStr: string       // YYYY-MM-DD
  day: number           // day of month
  isCurrentMonth: boolean
  isToday: boolean
  isSunday: boolean
  isSaturday: boolean
}

export function getMonthGrid(monthDate: Date): CalendarDay[] {
  const monthStart = startOfMonth(monthDate)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })

  const days: CalendarDay[] = []
  for (let i = 0; i < 42; i++) {
    const date = addDays(calendarStart, i)
    days.push({
      date,
      dateStr: format(date, 'yyyy-MM-dd'),
      day: date.getDate(),
      isCurrentMonth: isSameMonth(date, monthDate),
      isToday: isToday(date),
      isSunday: getDay(date) === 0,
      isSaturday: getDay(date) === 6,
    })
  }
  return days
}

export function getMonthTitle(date: Date): string {
  return format(date, 'yyyy년 M월')
}

export function nextMonth(date: Date): Date {
  return addMonths(date, 1)
}

export function prevMonth(date: Date): Date {
  return subMonths(date, 1)
}

export function isSameDateStr(a: string, b: string): boolean {
  return a === b
}

export const DAY_HEADERS = ['일', '월', '화', '수', '목', '금', '토']
