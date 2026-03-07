import { useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  addMonths,
  subMonths,
  isToday,
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

  const daysInMonth = useMemo(
    () => eachDayOfInterval({ start: monthStart, end: monthEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentMonth.getTime()]
  )

  return (
    <div className="card @container p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange(subMonths(currentMonth, 1))}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
          aria-label="이전 달"
        >
          <ChevronLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
        </button>
        <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h2>
        <button
          onClick={() => onMonthChange(addMonths(currentMonth, 1))}
          className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
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
              i > 0 && i < 6 && 'text-zinc-400 dark:text-zinc-500'
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5">
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
              className={clsx(
                'aspect-square flex flex-col items-center justify-center rounded-xl relative transition-colors',
                isSelected && 'bg-primary-500 text-white',
                !isSelected && isTodayDate && 'ring-2 ring-primary-400 ring-inset',
                !isSelected && 'hover:bg-zinc-100 dark:hover:bg-zinc-700',
                !isSelected && dayOfWeek === 0 && 'text-danger-500',
                !isSelected && dayOfWeek === 6 && 'text-primary-500',
                !isSelected && dayOfWeek > 0 && dayOfWeek < 6 && 'text-zinc-700 dark:text-zinc-300'
              )}
            >
              <span className="text-xs @xs:text-sm font-medium">{format(day, 'd')}</span>
              {count > 0 && (
                <div className="absolute bottom-1 flex gap-0.5">
                  {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                    <div
                      key={i}
                      className={clsx(
                        'w-1 h-1 rounded-full',
                        isSelected ? 'bg-white/80' : 'bg-primary-400 dark:bg-primary-500'
                      )}
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
            onMonthChange(new Date())
            onDateSelect(format(new Date(), 'yyyy-MM-dd'))
          }}
          className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
        >
          오늘
        </button>
      </div>
    </div>
  )
}
