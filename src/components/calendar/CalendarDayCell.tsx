import { memo } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

interface CalendarDayCellProps {
  day: Date
  dateStr: string
  inMonth: boolean
  isSelected: boolean
  isTodayDate: boolean
  count: number
  tabbable: boolean
  onSelect: (day: Date, dateStr: string) => void
}

/**
 * 달력의 한 칸이에요. 키트의 Date Picker 칸(mw-date-picker__cell)과 날짜 버튼(mw-date-picker__day) 그대로예요.
 * 메모가 있는 날은 숫자 옆에 강조색 점을 찍고, 개수는 버튼의 이름(aria-label)과 도움말로 알려요.
 */
export const CalendarDayCell = memo(function CalendarDayCell({ day, dateStr, inMonth, isSelected, isTodayDate, count, tabbable, onSelect }: CalendarDayCellProps) {
  const cell = ['mw-date-picker__cell', isTodayDate && 'mw-date-picker__cell--today', isSelected && 'mw-date-picker__cell--selected', !inMonth && 'mw-date-picker__cell--outside'].filter(Boolean).join(' ')
  return (
    <td className={cell} aria-selected={isSelected || undefined}>
      <button
        type="button"
        className="mw-date-picker__day"
        data-date={dateStr}
        tabIndex={tabbable ? 0 : -1}
        onClick={() => onSelect(day, dateStr)}
        aria-label={`${format(day, 'yyyy년 M월 d일 EEEE', { locale: ko })}${count > 0 ? `, 메모 ${count}개` : ''}`}
        aria-current={isTodayDate ? 'date' : undefined}
        title={count > 0 ? `메모 ${count}개` : undefined}
      >
        {format(day, 'd')}
        {inMonth && count > 0 && <i className="memo-cal__mark" aria-hidden="true" />}
      </button>
    </td>
  )
})
