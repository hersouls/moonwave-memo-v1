import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMemoStore } from '@/stores/memoStore'
import { formatMemoDate } from '@/utils/format'
import { stripMarkdown } from '@/utils/textUtils'
import { WidgetCard } from './WidgetCard'
import { IcLineCalendar, IcMwHistory, IcMwSparkles } from '@/mw/icons'

export function MemoryLaneWidget() {
  const memos = useMemoStore((s) => s.memos)

  const { anniversaryMemos, randomRediscovery } = useMemo(() => {
    const now = new Date()
    const activeMemos = memos.filter((m) => !m.deletedAt)

    // Find memos created on the same month+day in previous years
    const anniversary = activeMemos.filter((m) => {
      const created = new Date(m.createdAt)
      return (
        created.getMonth() === now.getMonth() &&
        created.getDate() === now.getDate() &&
        created.getFullYear() < now.getFullYear()
      )
    }).slice(0, 3)

    // Random rediscovery: a memo older than 30 days (deterministic per day)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const oldMemos = activeMemos.filter((m) => new Date(m.createdAt) < thirtyDaysAgo)
    const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000)
    const random = oldMemos.length > 0
      ? oldMemos[dayOfYear % oldMemos.length]
      : null

    return { anniversaryMemos: anniversary, randomRediscovery: random }
  }, [memos])

  if (anniversaryMemos.length === 0 && !randomRediscovery) return null

  return (
    <WidgetCard icon={IcMwHistory} tint="amber" title="추억 돌아보기">
      {anniversaryMemos.length > 0 && (
        <div className={randomRediscovery ? 'mb-4' : undefined}>
          <div className="mb-2 flex items-center gap-1.5">
            <IcLineCalendar size={16} className="text-zinc-400" aria-hidden="true" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">이 날의 추억</span>
          </div>
          <div className="space-y-2">
            {anniversaryMemos.map((memo) => (
              <Link
                key={memo.id}
                to={`/memo/${memo.id}`}
                className="w-full text-left px-3 py-2 rounded-xl bg-zinc-50 dark:bg-white/[0.04] hover:bg-zinc-100 dark:hover:bg-white/[0.08] transition-colors"
              >
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {memo.title || '제목 없음'}
                </p>
                <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {new Date(memo.createdAt).getFullYear()}년 ·{' '}
                  {stripMarkdown(memo.body).slice(0, 40)}
                  {memo.body.length > 40 ? '...' : ''}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {randomRediscovery && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <IcMwSparkles size={16} className="text-amber-400" aria-hidden="true" />
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">다시 발견하기</span>
          </div>
          <Link
            to={`/memo/${randomRediscovery.id}`}
            className="w-full text-left px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
          >
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
              {randomRediscovery.title || '제목 없음'}
            </p>
            <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 mt-0.5">
              {formatMemoDate(randomRediscovery.createdAt)} ·{' '}
              {stripMarkdown(randomRediscovery.body).slice(0, 40)}
              {randomRediscovery.body.length > 40 ? '...' : ''}
            </p>
          </Link>
        </div>
      )}
    </WidgetCard>
  )
}
