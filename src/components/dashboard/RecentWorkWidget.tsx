import { useMemoStore } from '@/stores/memoStore'
import { formatMemoDate } from '@/utils/format'
import { stripMarkdown } from '@/utils/textUtils'
import { useViewTransition } from '@/hooks/useViewTransition'
import { WidgetCard } from './WidgetCard'
import { IcLineChevronRight, IcLineTime } from '@/mw/icons'
import { Link } from 'react-router-dom'

export function RecentWorkWidget() {
  const { navigateWithTransition } = useViewTransition()
  const memos = useMemoStore((s) => s.memos)

  const recentMemos = memos
    .filter((m) => !m.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)

  if (recentMemos.length === 0) return null

  return (
    <WidgetCard
      icon={IcLineTime}
      tint="primary"
      title="최근 작업"
      action={
        <Link
          to="/memos"
          onClick={(e) => { e.preventDefault(); navigateWithTransition('/memos') }}
          className="mw-text-button mw-text-button--chevron mw-text-button--medium mw-text-button--default"
        >
          <span>모두 보기</span>
          <IcLineChevronRight />
        </Link>
      }
      bodyClassName="p-0"
    >
      <div className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
        {recentMemos.map((memo) => (
          <Link
            key={memo.id}
            to={`/memo/${memo.id}`}
            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {memo.title || '제목 없음'}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                {stripMarkdown(memo.body).slice(0, 60) || '내용 없음'}
              </p>
            </div>
            <span className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
              {formatMemoDate(memo.updatedAt)}
            </span>
          </Link>
        ))}
      </div>
    </WidgetCard>
  )
}
