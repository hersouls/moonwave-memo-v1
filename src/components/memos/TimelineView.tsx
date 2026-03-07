import { useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import type { Memo } from '@/lib/types'
import { MemoCard } from './MemoCard'

interface TimelineViewProps {
  memos: Memo[]
}

export function TimelineView({ memos }: TimelineViewProps) {
  const grouped = useMemo(() => {
    const groups = new Map<string, Memo[]>()

    for (const memo of memos) {
      const dateKey = format(parseISO(memo.createdAt), 'yyyy\uB144 M\uC6D4 d\uC77C', {
        locale: ko,
      })
      const existing = groups.get(dateKey)
      if (existing) {
        existing.push(memo)
      } else {
        groups.set(dateKey, [memo])
      }
    }

    return Array.from(groups.entries())
  }, [memos])

  if (grouped.length === 0) return null

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-zinc-200 dark:bg-zinc-700" />

      <div className="flex flex-col gap-6">
        {grouped.map(([dateLabel, dateMemos]) => (
          <div key={dateLabel} className="relative">
            {/* Date header with dot */}
            <div className="flex items-center gap-3 mb-2">
              <div className="relative z-10 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary-500 bg-white dark:bg-zinc-900" />
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {dateLabel}
              </span>
              <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                {dateMemos.length}{'\uAC1C'}
              </span>
            </div>

            {/* Memo cards */}
            <div className="ml-7 flex flex-col gap-2">
              {dateMemos.map((memo, index) => (
                <MemoCard key={memo.id ?? `tl-${index}`} memo={memo} viewMode="list" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
