import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { CalendarDayCell } from './CalendarDayCell'
import { useFolderStore } from '@/stores/folderStore'
import type { Memo } from '@/lib/types'

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토']

// 셀 React.memo가 유효하도록 빈 칩 배열은 단일 참조를 재사용
const EMPTY_MEMOS: Memo[] = []

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
  getMemosForDate: (dateStr: string) => Memo[]
}

export function CalendarGrid({
  currentMonth,
  onMonthChange,
  selectedDate,
  onDateSelect,
  memoCounts,
  getMemosForDate,
}: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth)

  // 월 전환 방향 — 그리드 슬라이드 애니메이션에 사용
  const [monthDirection, setMonthDirection] = useState<'left' | 'right' | null>(null)

  const changeMonth = (target: Date) => {
    if (!isSameMonth(target, currentMonth)) {
      setMonthDirection(target.getTime() > currentMonth.getTime() ? 'right' : 'left')
    }
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

  // 폴더 색 → 칩 dot (셀 42개가 각자 구독하지 않도록 여기서 1회 계산)
  const folders = useFolderStore((s) => s.folders)
  const folderColorById = useMemo(
    () => new Map(folders.filter((f) => f.id != null).map((f) => [f.id as number, f.color])),
    [folders]
  )

  // 칩 배열을 날짜별로 메모이즈 — 선택만 바뀌는 렌더에서 배열 참조가 유지돼야 셀 memo가 유효
  const chipsByDate = useMemo(() => {
    const map = new Map<string, Memo[]>()
    memoCounts.forEach((count, dateStr) => {
      if (count > 0) map.set(dateStr, getMemosForDate(dateStr).slice(0, 2))
    })
    return map
  }, [memoCounts, getMemosForDate])

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
        setMonthDirection(day.getTime() > currentMonth.getTime() ? 'right' : 'left')
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

  return (
    <div className="card @container p-3 md:p-4 fold:p-2">
      {/* Month navigation — 제목 좌측 위계 + [◀ 오늘 ▶] 세그먼트 그룹 */}
      <div className="mb-3 flex items-center justify-between fold:mb-2">
        <h2
          aria-live="polite"
          className="text-lg font-bold tracking-[-0.01em] tabular-nums text-zinc-900 dark:text-zinc-100 fold:text-base"
        >
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </h2>
        <div
          role="group"
          aria-label="월 이동"
          className="flex items-center gap-0.5 rounded-lg border border-[var(--card-hairline)] p-0.5"
        >
          <button
            type="button"
            onClick={() => changeMonth(subMonths(currentMonth, 1))}
            aria-label="이전 달"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset dark:text-zinc-400"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              changeMonth(today)
              onDateSelect(todayStr)
            }}
            disabled={isTodaySelected}
            className="h-8 rounded-md px-2.5 text-xs font-medium text-zinc-600 transition-colors duration-150 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-40 dark:text-zinc-300 fold:px-2"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => changeMonth(addMonths(currentMonth, 1))}
            aria-label="다음 달"
            className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors duration-150 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-active)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset dark:text-zinc-400"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 스와이프 영역 = 요일 헤더 + 그리드 (메모 카드 스와이프와 서브트리 분리) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onKeyDown={handleKeyDown}
        className="[touch-action:pan-y]"
      >
        {/* Day of week headers — 확장 모드에서는 셀 좌상단 숫자와 좌정렬 */}
        <div className="mb-1 grid grid-cols-7">
          {DAY_NAMES.map((day, i) => (
            <div
              key={i}
              className={clsx(
                'py-1.5 text-center text-[11px] font-medium @lg:pl-1.5 @lg:text-left fold:text-[10px]',
                i === 0 && 'text-danger-600 dark:text-danger-400',
                i === 6 && 'text-primary-600 dark:text-primary-400',
                i > 0 && i < 6 && 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid — 42셀 고정, 월 전환 시 방향성 슬라이드 (fade는 상시, 이동은 motion-safe) */}
        <div
          ref={gridRef}
          key={format(currentMonth, 'yyyy-MM')}
          className={clsx(
            'grid grid-cols-7 gap-0.5 fold:gap-0',
            // 확장 모드: gap-px + 래퍼 배경색 = hairline 그리드 (다크는 border-default로 시인성 확보)
            '@lg:gap-px @lg:overflow-hidden @lg:rounded-xl @lg:border @lg:border-[var(--color-border-subtle)] @lg:bg-[var(--color-border-subtle)]',
            'dark:@lg:border-[var(--color-border-default)] dark:@lg:bg-[var(--color-border-default)]',
            'animate-in fade-in duration-200 ease-enter',
            monthDirection === 'right' && 'motion-safe:slide-in-from-right-3',
            monthDirection === 'left' && 'motion-safe:slide-in-from-left-3'
          )}
        >
          {gridDays.map((day) => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const inMonth = isSameMonth(day, currentMonth)
            const count = inMonth ? memoCounts.get(dateStr) || 0 : 0
            return (
              <CalendarDayCell
                key={dateStr}
                day={day}
                dateStr={dateStr}
                inMonth={inMonth}
                isSelected={selectedDate === dateStr}
                isTodayDate={isToday(day)}
                count={count}
                chipMemos={(inMonth && chipsByDate.get(dateStr)) || EMPTY_MEMOS}
                folderColorById={folderColorById}
                tabbable={rovingDate === dateStr}
                onSelect={handleSelect}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
