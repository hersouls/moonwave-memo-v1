import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  startOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  parseISO,
  format,
  isToday,
  isSameMonth,
} from 'date-fns'
import { ko } from 'date-fns/locale'
import { CalendarDayCell } from './CalendarDayCell'
import { IcLineChevronLeft, IcLineChevronRight } from '@/mw/icons'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

// 그리드 스와이프 커밋 임계 — fold(≤420) 좁은 화면은 화면 폭 비례 (MemoCard 문법)
function getSwipeThreshold() {
  return Math.max(48, Math.round(window.innerWidth * 0.15))
}

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

  const changeMonth = (target: Date) => {
    onMonthChange(target)
  }

  // 42셀 고정(6주) — 월 전환 시 카드 높이 점프 제거 + 확장 모드 hairline 그리드가 직사각형으로 닫힘
  const gridDays = useMemo(() => {
    const gridStart = startOfWeek(monthStart)
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMonth.getTime()])

  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  const isTodaySelected = isSameMonth(currentMonth, today) && selectedDate === todayStr

  // 로빙 tabindex 대상: 선택 날짜 → 오늘 → 당월 1일 (42셀 창 내에서)
  const firstStr = format(gridDays[0], 'yyyy-MM-dd')
  const lastStr = format(gridDays[41], 'yyyy-MM-dd')
  const inWindow = (s: string) => s >= firstStr && s <= lastStr
  const rovingDate =
    selectedDate && inWindow(selectedDate)
      ? selectedDate
      : inWindow(todayStr)
        ? todayStr
        : format(monthStart, 'yyyy-MM-dd')

  // ── 그리드 한정 터치 스와이프 (MemoCard 스와이프와 DOM 서브트리 분리) ──
  const touchStartX = useRef(-1)
  const touchStartY = useRef(0)
  const isSwipingRef = useRef(false)
  const suppressClickRef = useRef(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0]
    if (!touch) return
    // 화면 엣지 30px 시작은 무시 (iOS Safari 백/포워드 제스처 존)
    if (touch.clientX < 30 || touch.clientX > window.innerWidth - 30) {
      touchStartX.current = -1
      return
    }
    touchStartX.current = touch.clientX
    touchStartY.current = touch.clientY
    isSwipingRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current < 0) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current
    // 수평 우세 판정 후에만 스와이프 — 세로 스크롤 억제는 touch-action: pan-y가 담당
    // (React는 touchmove를 passive로 등록하므로 preventDefault는 no-op + 콘솔 경고만 남긴다)
    if (!isSwipingRef.current && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      isSwipingRef.current = true
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current < 0) return
    if (isSwipingRef.current) {
      const dx = e.changedTouches[0].clientX - touchStartX.current
      if (Math.abs(dx) >= getSwipeThreshold()) {
        navigator.vibrate?.(10)
        changeMonth(dx < 0 ? addMonths(currentMonth, 1) : subMonths(currentMonth, 1))
      }
      // 스와이프 직후 셀 click 이벤트가 날짜를 선택하지 않도록 가드
      suppressClickRef.current = true
      setTimeout(() => {
        suppressClickRef.current = false
      }, 0)
    }
    touchStartX.current = -1
    isSwipingRef.current = false
  }

  const handleTouchCancel = () => {
    touchStartX.current = -1
    isSwipingRef.current = false
  }

  // ── 키보드 로빙 포커스: ←→ ±1일 · ↑↓ ±7일 · Home/End 주 경계 · PageUp/Down ±1개월 ──
  const gridRef = useRef<HTMLDivElement>(null)
  const pendingFocusRef = useRef<string | null>(null)

  const focusCell = useCallback((dateStr: string) => {
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${dateStr}"]`)?.focus()
  }, [])

  // deps는 객체 identity — onMonthChange가 불릴 때마다(같은 월이어도) 발화해 ref가 고이지 않는다
  useEffect(() => {
    if (pendingFocusRef.current) {
      focusCell(pendingFocusRef.current)
      pendingFocusRef.current = null
    }
  }, [currentMonth, focusCell])

  // 셀 42개의 유일한 클릭 핸들러 — 선택만 바뀌는 렌더에서 참조가 유지돼야 React.memo가 유효
  const handleSelect = useCallback(
    (day: Date, dateStr: string) => {
      if (suppressClickRef.current) return
      if (!isSameMonth(day, currentMonth)) {
        // 인접월 셀 활성화: 그리드가 key 리마운트되므로 포커스를 새 셀로 이송
        pendingFocusRef.current = dateStr
        onMonthChange(day)
      }
      onDateSelect(dateStr)
    },
    [currentMonth, onMonthChange, onDateSelect]
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-date]')
    const dateStr = cell?.dataset.date
    if (!dateStr) return

    const current = parseISO(dateStr)
    let next: Date
    switch (e.key) {
      case 'ArrowLeft':
        next = addDays(current, -1)
        break
      case 'ArrowRight':
        next = addDays(current, 1)
        break
      case 'ArrowUp':
        next = addDays(current, -7)
        break
      case 'ArrowDown':
        next = addDays(current, 7)
        break
      case 'Home':
        next = startOfWeek(current)
        break
      case 'End':
        next = endOfWeek(current)
        break
      case 'PageUp':
        next = subMonths(current, 1)
        break
      case 'PageDown':
        next = addMonths(current, 1)
        break
      default:
        return
    }
    e.preventDefault()

    const nextStr = format(next, 'yyyy-MM-dd')
    const isPageJump = e.key === 'PageUp' || e.key === 'PageDown'
    if (!isPageJump && inWindow(nextStr)) {
      focusCell(nextStr)
    } else {
      // 42셀 창 밖(또는 월 점프) → 월 전환 후 리렌더된 셀로 포커스 이송
      pendingFocusRef.current = nextStr
      changeMonth(next)
    }
  }

  const weeks = Array.from({ length: gridDays.length / 7 }, (_, w) => gridDays.slice(w * 7, w * 7 + 7))
  const monthLabel = format(currentMonth, 'yyyy년 M월', { locale: ko })

  // 키트의 Date Picker(달력)예요. 화면에 늘 펼쳐 두는 달력이라 팝오버가 아니라 카드 안에 그려요.
  return (
    <div className="mw-surface">
      <div className="mw-date-picker">
        <div className="mw-date-picker__header">
          <button type="button" className="mw-date-picker__nav" onClick={() => changeMonth(subMonths(currentMonth, 1))} aria-label="이전 달">
            <IcLineChevronLeft size={20} />
          </button>
          <h2 className="mw-date-picker__title" aria-live="polite">{monthLabel}</h2>
          <button type="button" className="mw-date-picker__nav" onClick={() => changeMonth(addMonths(currentMonth, 1))} aria-label="다음 달">
            <IcLineChevronRight size={20} />
          </button>
          <button
            type="button"
            className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
            onClick={() => { changeMonth(today); onDateSelect(todayStr) }}
            disabled={isTodaySelected}
          >
            <span>오늘</span>
          </button>
        </div>

        {/* 옆으로 밀면 달이 넘어가요. 화살표 키로 날짜를 옮겨요. */}
        <div
          ref={gridRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onKeyDown={handleKeyDown}
          className="[touch-action:pan-y]"
          data-gesture="off"
        >
          <table className="mw-date-picker__grid" role="grid" aria-label={monthLabel} key={format(currentMonth, 'yyyy-MM')}>
            <thead>
              <tr>
                {DAY_NAMES.map((day, i) => (
                  <th key={i} scope="col" className="mw-date-picker__weekday" abbr={`${day}요일`}>{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={format(week[0], 'yyyy-MM-dd')}>
                  {week.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd')
                    const inMonth = isSameMonth(day, currentMonth)
                    return (
                      <CalendarDayCell
                        key={dateStr}
                        day={day}
                        dateStr={dateStr}
                        inMonth={inMonth}
                        isSelected={selectedDate === dateStr}
                        isTodayDate={isToday(day)}
                        count={inMonth ? memoCounts.get(dateStr) || 0 : 0}
                        tabbable={rovingDate === dateStr}
                        onSelect={handleSelect}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
