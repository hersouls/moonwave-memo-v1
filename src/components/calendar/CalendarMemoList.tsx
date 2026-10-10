import { useEffect, useRef } from 'react'
import { format, parseISO, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { MemoCard } from '@/components/memos/MemoCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Memo } from '@/lib/types'
import { IcLineCalendar, IcLineEdit } from '@/mw/icons'

interface CalendarMemoListProps {
  memos: Memo[]
  selectedDate: string | null
}

export function CalendarMemoList({ memos, selectedDate }: CalendarMemoListProps) {
  const navigate = useNavigate()

  // 데스크톱에서 카드가 내부 스크롤 컨테이너 — 날짜 전환 시 스크롤 위치 초기화
  const cardRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    cardRef.current?.scrollTo({ top: 0 })
  }, [selectedDate])

  if (!selectedDate) {
    return (
      <div className="card p-4">
        <EmptyState
          size="sm"
          icon={<IcLineCalendar size={24} className="text-zinc-300 dark:text-zinc-600" />}
          title="날짜를 골라 주세요"
          description="날짜를 누르면 그날 쓴 메모를 볼 수 있어요."
        />
      </div>
    )
  }

  const selected = parseISO(selectedDate)
  const isSelectedToday = isToday(selected)

  return (
    // .card는 overflow:hidden — 스크롤은 내부 요소로 분리해야 동작한다
    <div className="card lg:flex lg:max-h-[calc(100vh-6.5rem)] lg:flex-col">
      <div
        ref={cardRef}
        className="p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"
      >
      {/* 날짜 변경 시 콘텐츠 전체가 부드럽게 등장 */}
      <div
        key={selectedDate}
        className="animate-in fade-in duration-200 ease-enter motion-safe:slide-in-from-bottom-1"
      >
        {/* 헤더: 날짜 위계 + 오늘 배지 + 카운트 필, 데스크톱 내부 스크롤에서 sticky */}
        <div className="-mx-4 mb-3 border-b border-[var(--card-hairline)] px-4 pb-3 lg:sticky lg:top-0 lg:z-10 lg:-mt-4 lg:bg-[var(--card-bg-default)] lg:pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <h3 className="shrink-0 text-15 font-semibold tracking-[-0.01em] text-zinc-900 dark:text-zinc-100">
                {format(selected, 'M월 d일', { locale: ko })}
              </h3>
              <span className="truncate text-sm font-medium text-zinc-500 dark:text-zinc-400">
                <span className="fold:hidden">{format(selected, 'EEEE', { locale: ko })}</span>
                <span className="hidden fold:inline">{format(selected, 'EEE', { locale: ko })}</span>
              </span>
              {isSelectedToday && (
                <span className="shrink-0 rounded-md bg-primary-500/10 px-1.5 py-0.5 text-xs font-semibold text-primary-600 ">
                  오늘
                </span>
              )}
            </div>
            <span
              aria-live="polite"
              className="shrink-0 rounded-full bg-[var(--color-bg-tertiary)] px-2 py-0.5 text-xs font-medium tabular-nums text-[var(--color-text-secondary)]"
            >
              {memos.length}개<span className="fold:hidden"> 메모</span>
            </span>
          </div>
        </div>

        {memos.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<IcLineCalendar size={24} className="text-zinc-300 dark:text-zinc-600" />}
            title="이 날짜에는 메모가 없어요"
            description={
              isSelectedToday
                ? '새 메모를 써서 오늘을 기록해 보세요.'
                : '이 날짜에 쓴 메모가 없어요.'
            }
            action={
              isSelectedToday ? (
                <button type="button"
                  onClick={() => navigate('/memo/new')}
                  className="mw-button mw-button--primary mw-button--medium mw-button--icon-left mt-3"
                >
                  <IcLineEdit size={16} />
                  메모 쓰기
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {memos.map((memo, i) => (
              <div
                key={memo.id}
                className="animate-in fade-in fill-mode-backwards duration-200 ease-enter motion-safe:slide-in-from-bottom-1"
                style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }}
              >
                <MemoCard memo={memo} viewMode="list" />
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
