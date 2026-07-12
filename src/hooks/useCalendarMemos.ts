import { useMemo, useCallback } from 'react'
import { startOfMonth, endOfMonth, format } from 'date-fns'
import { useMemoStore } from '@/stores/memoStore'
import type { Memo } from '@/lib/types'

interface CalendarMemoData {
  memoCounts: Map<string, number>
  getMemosForDate: (dateStr: string) => Memo[]
}

export function useCalendarMemos(currentMonth: Date): CalendarMemoData {
  const memos = useMemoStore((s) => s.memos)

  const activeMemos = useMemo(() => memos.filter((m) => !m.deletedAt), [memos])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const monthStartTime = monthStart.getTime()
  const monthEndTime = monthEnd.getTime()

  const memosByDate = useMemo(() => {
    const map = new Map<string, Memo[]>()
    for (const memo of activeMemos) {
      const created = new Date(memo.createdAt)
      const createdTime = created.getTime()

      if (createdTime >= monthStartTime && createdTime <= monthEndTime) {
        const dateStr = format(created, 'yyyy-MM-dd')
        const existing = map.get(dateStr)
        if (existing) {
          existing.push(memo)
        } else {
          map.set(dateStr, [memo])
        }
      }
    }
    return map
  }, [activeMemos, monthStartTime, monthEndTime])

  const memoCounts = useMemo(() => {
    const counts = new Map<string, number>()
    memosByDate.forEach((list, dateStr) => {
      counts.set(dateStr, list.length)
    })
    return counts
  }, [memosByDate])

  const monthPrefix = format(monthStart, 'yyyy-MM')

  const getMemosForDate = useCallback(
    (dateStr: string): Memo[] => {
      const inMonth = memosByDate.get(dateStr)
      if (dateStr.startsWith(monthPrefix)) return inMonth || []
      // 표시 월 밖 날짜(월 이동 후에도 유지되는 선택)도 정직한 데이터를 반환
      return activeMemos.filter(
        (m) => format(new Date(m.createdAt), 'yyyy-MM-dd') === dateStr
      )
    },
    [memosByDate, monthPrefix, activeMemos]
  )

  return { memoCounts, getMemosForDate }
}
