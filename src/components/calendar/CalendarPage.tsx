import { useState } from 'react'
import { format } from 'date-fns'
import { CalendarGrid } from './CalendarGrid'
import { CalendarMemoList } from './CalendarMemoList'
import { useCalendarMemos } from '@/hooks/useCalendarMemos'
import { CreateActions, PageHead } from '@/components/layout/PageHead'

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(
    () => format(new Date(), 'yyyy-MM-dd')
  )

  const { memoCounts, getMemosForDate } = useCalendarMemos(currentMonth)
  const selectedMemos = selectedDate ? getMemosForDate(selectedDate) : []

  return (
    <div className="mw-page">
      <PageHead title="캘린더" description="날짜를 누르면 그날 쓴 메모를 볼 수 있어요." actions={<CreateActions />} />
      {/* 데스크톱 면적 역전: 캘린더 = flex-1 주인공, 선택 날짜 패널 = 우측 고정폭 인스펙터 */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:gap-6">
        <div className="w-full xl:min-w-0 xl:flex-1">
          <CalendarGrid
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            memoCounts={memoCounts}
            getMemosForDate={getMemosForDate}
          />
        </div>
        <div className="w-full xl:sticky xl:top-0 xl:w-[360px] xl:shrink-0">
          <CalendarMemoList
            memos={selectedMemos}
            selectedDate={selectedDate}
          />
        </div>
      </div>
    </div>
  )
}
