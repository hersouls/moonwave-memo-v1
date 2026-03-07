import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarGrid } from './CalendarGrid'
import { CalendarMemoList } from './CalendarMemoList'
import { useCalendarMemos } from '@/hooks/useCalendarMemos'
import { FAB } from '@/components/ui/FAB'

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(
    () => format(new Date(), 'yyyy-MM-dd')
  )

  const { memoCounts, getMemosForDate } = useCalendarMemos(currentMonth)
  const selectedMemos = selectedDate ? getMemosForDate(selectedDate) : []

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-4 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-4">
        <CalendarGrid
          currentMonth={currentMonth}
          onMonthChange={setCurrentMonth}
          selectedDate={selectedDate}
          onDateSelect={setSelectedDate}
          memoCounts={memoCounts}
        />
        <CalendarMemoList
          memos={selectedMemos}
          selectedDate={selectedDate}
        />
      </div>
      <FAB />
    </div>
  )
}
