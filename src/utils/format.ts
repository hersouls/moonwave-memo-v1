import { format, isToday, isYesterday, isThisYear, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatMemoDate(dateStr: string): string {
  const date = parseISO(dateStr)

  if (isToday(date)) {
    return format(date, 'a h:mm', { locale: ko })
  }
  if (isYesterday(date)) {
    return '어제'
  }
  if (isThisYear(date)) {
    return format(date, 'M. d.', { locale: ko })
  }
  return format(date, 'yyyy. M. d.', { locale: ko })
}

export function formatFullDate(dateStr: string): string {
  const date = parseISO(dateStr)
  return format(date, 'yyyy년 M월 d일 a h:mm', { locale: ko })
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength) + '…'
}
