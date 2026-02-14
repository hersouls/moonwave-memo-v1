import { useState, useMemo, useCallback } from 'react'
import { format } from 'date-fns'
import {
  getMonthGrid,
  getMonthTitle,
  nextMonth,
  prevMonth,
  type CalendarDay,
} from '@/lib/calendarUtils'

export function useCalendar() {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date())
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  )

  const monthGrid: CalendarDay[] = useMemo(
    () => getMonthGrid(currentMonth),
    [currentMonth]
  )

  const monthTitle = useMemo(
    () => getMonthTitle(currentMonth),
    [currentMonth]
  )

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => nextMonth(prev))
  }, [])

  const goToPrevMonth = useCallback(() => {
    setCurrentMonth((prev) => prevMonth(prev))
  }, [])

  const goToToday = useCallback(() => {
    const today = new Date()
    setCurrentMonth(today)
    setSelectedDate(format(today, 'yyyy-MM-dd'))
  }, [])

  const selectDate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr)
  }, [])

  return {
    currentMonth,
    selectedDate,
    monthGrid,
    monthTitle,
    goToNextMonth,
    goToPrevMonth,
    goToToday,
    selectDate,
  }
}
