import { DAY_HEADERS, type CalendarDay } from '@/lib/calendarUtils'
import { DayCell } from './DayCell'

interface CalendarGridProps {
  days: CalendarDay[]
  taskDates: Set<string>
  selectedDate: string
  onSelectDate: (dateStr: string) => void
}

export function CalendarGrid({ days, taskDates, selectedDate, onSelectDate }: CalendarGridProps) {
  return (
    <div className="w-full">
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map((header, i) => (
          <div
            key={header}
            className={`text-center text-xs font-medium py-2 ${
              i === 0
                ? 'text-red-500'
                : i === 6
                  ? 'text-blue-500'
                  : 'text-zinc-400 dark:text-zinc-500'
            }`}
          >
            {header}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map((day) => (
          <DayCell
            key={day.dateStr}
            day={day}
            hasTask={taskDates.has(day.dateStr)}
            isSelected={selectedDate === day.dateStr}
            onClick={onSelectDate}
          />
        ))}
      </div>
    </div>
  )
}
