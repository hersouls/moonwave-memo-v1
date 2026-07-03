import { format, parseISO, isToday } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CalendarPlus, Pencil } from 'lucide-react'
import { MemoCard } from '@/components/memos/MemoCard'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Memo } from '@/lib/types'

interface CalendarMemoListProps {
  memos: Memo[]
  selectedDate: string | null
}

export function CalendarMemoList({ memos, selectedDate }: CalendarMemoListProps) {
  const navigate = useNavigate()

  if (!selectedDate) {
    return (
      <div className="card p-4">
        <EmptyState
          size="sm"
          icon={<CalendarDays className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />}
          title="날짜를 선택하세요"
          description="날짜를 선택하면 해당 날짜의 메모를 볼 수 있습니다."
        />
      </div>
    )
  }

  const dateLabel = format(parseISO(selectedDate), 'M월 d일 (EEEE)', { locale: ko })
  const isSelectedToday = isToday(parseISO(selectedDate))

  return (
    <div className="card p-4">
      {/* 날짜 변경 시 콘텐츠 전체가 부드럽게 등장 */}
      <div
        key={selectedDate}
        className="animate-in fade-in slide-in-from-bottom-1 duration-200 ease-enter"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {dateLabel}
          </h3>
          <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
            {memos.length}개 메모
          </span>
        </div>

        {memos.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<CalendarPlus className="h-6 w-6 text-zinc-300 dark:text-zinc-600" />}
            title="이 날짜에는 메모가 없어요"
            description={
              isSelectedToday
                ? '새 메모를 작성해 오늘을 기록해보세요.'
                : '이 날짜에 작성된 메모가 없습니다.'
            }
            action={
              isSelectedToday ? (
                <button
                  onClick={() => navigate('/memo/new')}
                  className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                >
                  <Pencil className="h-4 w-4" />
                  메모 작성
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-2.5">
            {memos.map((memo, i) => (
              <div
                key={memo.id}
                className="animate-in fade-in slide-in-from-bottom-1 fill-mode-backwards duration-200 ease-enter"
                style={{ animationDelay: `${Math.min(i, 6) * 25}ms` }}
              >
                <MemoCard memo={memo} viewMode="list" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
