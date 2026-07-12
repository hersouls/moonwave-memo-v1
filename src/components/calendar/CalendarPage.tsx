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
    <div className="mx-auto w-full max-w-2xl px-4 py-4 md:max-w-3xl lg:max-w-7xl lg:px-6 lg:py-6 xl:px-8 fold:px-3">
      {/* 데스크톱 면적 역전: 캘린더 = flex-1 주인공, 선택 날짜 패널 = 우측 고정폭 인스펙터 */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        <div className="w-full lg:min-w-0 lg:flex-1">
          <CalendarGrid
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            memoCounts={memoCounts}
            getMemosForDate={getMemosForDate}
          />
        </div>
        <div className="w-full lg:sticky lg:top-20 lg:w-[320px] lg:shrink-0 xl:w-[360px]">
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
