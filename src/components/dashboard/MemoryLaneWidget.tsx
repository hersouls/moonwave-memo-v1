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

  // 카드 안은 한 겹이에요: 줄마다 따로 칠한 상자 없이 1px 선으로 나눠요(memo-lane__item)
  return (
    <WidgetCard icon={IcMwHistory} tint="amber" title="추억 돌아보기" bodyClassName="p-0">
      {anniversaryMemos.length > 0 && (
        <section aria-labelledby="memo-lane-day">
          <div className="memo-lane__label">
            <IcLineCalendar size={16} className="text-zinc-400" aria-hidden="true" />
            <h3 id="memo-lane-day" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">이 날의 추억</h3>
          </div>
          {anniversaryMemos.map((memo) => (
            <Link
              key={memo.id}
              to={`/memo/${memo.id}`}
              className="memo-lane__item transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
            >
              <p className="mw-ellipsis text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {memo.title || '제목 없음'}
              </p>
              <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 mt-0.5">
                {new Date(memo.createdAt).getFullYear()}년 ·{' '}
                {stripMarkdown(memo.body).slice(0, 40)}
                {memo.body.length > 40 ? '…' : ''}
              </p>
            </Link>
          ))}
        </section>
      )}

      {randomRediscovery && (
        <section aria-labelledby="memo-lane-again" className={anniversaryMemos.length > 0 ? 'memo-lane__group' : undefined}>
          <div className="memo-lane__label">
            <IcMwSparkles size={16} className="text-amber-400" aria-hidden="true" />
            <h3 id="memo-lane-again" className="text-xs font-medium text-zinc-500 dark:text-zinc-400">다시 발견하기</h3>
          </div>
          <Link
            to={`/memo/${randomRediscovery.id}`}
            className="memo-lane__item transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
          >
            <p className="mw-ellipsis text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {randomRediscovery.title || '제목 없음'}
            </p>
            <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 mt-0.5">
              {formatMemoDate(randomRediscovery.createdAt)} ·{' '}
              {stripMarkdown(randomRediscovery.body).slice(0, 40)}
              {randomRediscovery.body.length > 40 ? '…' : ''}
            </p>
          </Link>
        </section>
      )}
    </WidgetCard>
  )
}
