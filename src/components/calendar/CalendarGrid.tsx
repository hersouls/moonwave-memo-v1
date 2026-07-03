import { useMemo, useState } from 'react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  addMonths,
  subMonths,
  isToday,
  isSameMonth,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

interface CalendarGridProps {
  currentMonth: Date
  onMonthChange: (date: Date) => void
  selectedDate: string | null
  onDateSelect: (date: string) => void
  memoCounts: Map<string, number>
}

export function CalendarGrid({
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
  memoCounts,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const startDayOfWeek = getDay(monthStart)

  // 월 전환 방향 — 그리드 슬라이드 애니메이션에 사용
  const [monthDirection, setMonthDirection] = useState<'left' | 'right' | null>(null)

  const changeMonth = (target: Date) => {
    if (!isSameMonth(target, currentMonth)) {
      setMonthDirection(target.getTime() > currentMonth.getTime() ? 'right' : 'left')
    }
    onMonthChange(target)
  }

  const daysInMonth = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMonth.getTime()]
  )

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const isTodaySelected = isSameMonth(currentMonth, today) && selectedDate === todayStr

  return (
    <div className="card @container p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => changeMonth(subMonths(currentMonth, 1))}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="이전 달"
        >
          <ChevronLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <h2 className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h2>
        <button
          onClick={() => changeMonth(addMonths(currentMonth, 1))}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="다음 달"
        >
          <ChevronRight className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
      </div>

      {/* Day of week headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((day, i) => (
          <div
            key={i}
            className={clsx(
              'text-center text-xs font-medium py-1.5',
              i === 0 && 'text-danger-500',
              i === 6 && 'text-primary-500',
              i > 0 && i < 6 && 'text-zinc-500 dark:text-zinc-400'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid — 월이 바뀔 때 방향성 있는 슬라이드 인 */}
      <div
        key={format(currentMonth, 'yyyy-MM')}
        className={clsx(
          'grid grid-cols-7 gap-0.5',
          monthDirection === 'right' && 'animate-in fade-in slide-in-from-right-3 duration-200 ease-enter',
          monthDirection === 'left' && 'animate-in fade-in slide-in-from-left-3 duration-200 ease-enter'
        )}
      >
        {/* Leading blanks */}
        {Array.from({ length: startDayOfWeek }).map((_, i) => (
          <div key={`blank-${i}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {daysInMonth.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const count = memoCounts.get(dateStr) || 0
          const isSelected = selectedDate === dateStr
          const isTodayDate = isToday(day)
          const dayOfWeek = getDay(day)

          return (
            <button
              key={dateStr}
              onClick={() => onDateSelect(dateStr)}
              aria-label={`${format(day, 'M월 d일 EEEE', { locale: ko })}${count > 0 ? `, 메모 ${count}개` : ''}`}
              aria-pressed={isSelected}
              aria-current={isTodayDate ? 'date' : undefined}
              className={clsx(
                'aspect-square flex flex-col items-center justify-center rounded-xl relative transition-colors',
                'hover:bg-zinc-100 dark:hover:bg-zinc-700',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1'
              )}
            >
              {/* 날짜 숫자 디스크 — 선택/오늘 상태는 디스크만 채운다 */}
              <span
                className={clsx(
                  'w-8 h-8 flex items-center justify-center rounded-full text-xs @xs:text-sm tabular-nums transition-colors',
                  isSelected || isTodayDate ? 'font-semibold' : 'font-medium',
                  isSelected &&
                    'bg-[var(--color-accent)] text-[var(--color-on-accent)]',
                  !isSelected && isTodayDate &&
                    'bg-primary-500/10 text-primary-600 dark:text-primary-400',
                  !isSelected && !isTodayDate && dayOfWeek === 0 && 'text-danger-500',
                  !isSelected && !isTodayDate && dayOfWeek === 6 && 'text-primary-500',
                  !isSelected && !isTodayDate && dayOfWeek > 0 && dayOfWeek < 6 &&
                    'text-zinc-700 dark:text-zinc-300'
                )}
              >
                {format(day, 'd')}
              </span>
              {count > 0 && (
                <div className="absolute bottom-1.5 flex gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full bg-primary-500 dark:bg-primary-400"
                    />
                  ))}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Today shortcut */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={() => {
            changeMonth(today)
            onDateSelect(todayStr)
          }}
          disabled={isTodaySelected}
          className="px-3 py-1.5 min-h-[32px] rounded-full text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 active:bg-primary-100 dark:active:bg-primary-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40 disabled:pointer-events-none"
        >
          오늘
        </button>
      </div>
    </div>
  )
}
