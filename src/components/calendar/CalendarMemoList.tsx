import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MemoCard } from '@/components/memos/MemoCard'
import type { Memo } from '@/lib/types'

interface CalendarMemoListProps {
  memos: Memo[]
  selectedDate: string | null
}

export function CalendarMemoList({ memos, selectedDate }: CalendarMemoListProps) {
  if (!selectedDate) {
    return (
      <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-6 text-center">
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          날짜를 선택하면 해당 날짜의 메모를 볼 수 있습니다.
        </p>
      </div>
    )
  }

  const dateLabel = format(parseISO(selectedDate), 'M월 d일 (EEEE)', { locale: ko })

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {dateLabel}
        </h3>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {memos.length}개 메모
        </span>
      </div>

      {memos.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-4">
          이 날짜에 작성된 메모가 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {memos.map((memo) => (
            <MemoCard key={memo.id} memo={memo} viewMode="list" />
          ))}
        </div>
      )}
    </div>
  )
}
