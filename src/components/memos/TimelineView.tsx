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
      {/* Vertical timeline line \u2014 structural token so dark parity is automatic */}
      <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-[var(--color-border-default)]" />

      <div className="flex flex-col gap-6">
        {grouped.map(([dateLabel, dateMemos]) => (
          <div key={dateLabel} className="relative">
            {/* Date header with dot \u2014 sticky so temporal context survives long groups */}
            <div className="sticky top-0 z-10 -mx-1 mb-2 flex items-center gap-3 px-1 py-1 backdrop-blur-sm bg-[color-mix(in_oklch,var(--color-bg-primary)_85%,transparent)]">
              <div className="relative z-10 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-primary-500 bg-[var(--color-bg-primary)]" />
              <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                {dateLabel}
              </span>
              <span className="text-[11px] tabular-nums text-zinc-500 dark:text-zinc-400">
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
