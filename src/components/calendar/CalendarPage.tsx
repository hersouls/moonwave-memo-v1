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
  const monthTotal = [...memoCounts.values()].reduce((sum, n) => sum + n, 0)

  return (
    <div className="mw-page">
      <PageHead title="캘린더" description="날짜를 누르면 그날 쓴 메모를 볼 수 있어요." actions={<CreateActions />} />
      {/* 넓은 화면: 달력은 제 크기로 왼쪽에, 남은 너비는 그날의 메모가 여러 칸으로 써요 (.memo-calendar, index.css).
          달력을 화면 너비만큼 늘리면 날짜 사이만 벌어지고 그 아래가 통째로 비어요. */}
      <div className="memo-calendar">
        <div className="memo-calendar__side">
          <CalendarGrid
            currentMonth={currentMonth}
            onMonthChange={setCurrentMonth}
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            memoCounts={memoCounts}
          />
          <dl className="mw-surface memo-calendar__month">
            <div>
              <dt>이 달에 쓴 메모</dt>
              <dd>{monthTotal.toLocaleString()}<small>개</small></dd>
            </div>
            <div>
              <dt>메모를 쓴 날</dt>
              <dd>{memoCounts.size}<small>일</small></dd>
            </div>
          </dl>
        </div>
        <div className="memo-calendar__list">
          <CalendarMemoList
            memos={selectedMemos}
            selectedDate={selectedDate}
          />
        </div>
      </div>
    </div>
  )
}
