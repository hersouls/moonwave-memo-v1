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
    <div className="mx-auto w-full max-w-2xl lg:max-w-4xl xl:max-w-5xl px-4 py-4 lg:px-8 lg:py-6">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="lg:w-[360px] lg:shrink-0 lg:sticky lg:top-0 xl:w-[420px]">
          <CalendarGrid
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            memoCounts={memoCounts}
          />
        </div>
        <div className="lg:flex-1 lg:min-w-0">
          <CalendarMemoList
            memos={selectedMemos}
            selectedDate={selectedDate}
          />
        </div>
      </div>
      <FAB />
    </div>
  )
}
