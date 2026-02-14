import { clsx } from 'clsx'
import type { CalendarDay } from '@/lib/calendarUtils'

interface DayCellProps {
  day: CalendarDay
  hasTask: boolean
  isSelected: boolean
  onClick: (dateStr: string) => void
}

export function DayCell({ day, hasTask, isSelected, onClick }: DayCellProps) {
  return (
    <button
      type="button"
      onClick={() => onClick(day.dateStr)}
      aria-label={`${day.date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })}${hasTask ? ', 작업 있음' : ''}`}
      className={clsx(
        'relative flex flex-col items-center justify-center w-full aspect-square rounded-full text-sm transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        // Today styling
        day.isToday && !isSelected && 'bg-primary-500 text-white font-bold',
        // Selected styling
        isSelected && !day.isToday && 'ring-2 ring-primary-500 font-semibold',
        // Today + Selected
        isSelected && day.isToday && 'bg-primary-500 text-white font-bold ring-2 ring-primary-300',
        // Not current month
        !day.isCurrentMonth && 'text-zinc-300 dark:text-zinc-600',
        // Current month default
        day.isCurrentMonth && !day.isToday && !isSelected && 'text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800',
        // Sunday red text (only if visible and not today/selected with white text)
        day.isSunday && day.isCurrentMonth && !day.isToday && 'text-red-500',
        // Saturday blue text
        day.isSaturday && day.isCurrentMonth && !day.isToday && 'text-blue-500',
      )}
    >
      <span>{day.day}</span>
      {/* Task indicator dot */}
      {hasTask && (
        <span
          className={clsx(
            'absolute bottom-0.5 w-1.5 h-1.5 rounded-full',
            day.isToday ? 'bg-white' : 'bg-primary-500'
          )}
        />
      )}
    </button>
  )
}
