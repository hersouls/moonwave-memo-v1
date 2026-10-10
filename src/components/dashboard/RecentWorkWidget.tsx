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
      {/* 카드가 넓으면 세 건을 나란히, 좁으면 아래로 쌓아요. 칸 사이의 선은 위 · 왼쪽 선을 바깥으로 1px 밀어 가려요 */}
      <div className="overflow-hidden">
        <div className="memo-recent">
          {recentMemos.map((memo) => (
            <Link
              key={memo.id}
              to={`/memo/${memo.id}`}
              className="memo-recent__item transition-colors hover:bg-zinc-50 dark:hover:bg-white/[0.03]"
            >
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {memo.title || '제목 없음'}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {stripMarkdown(memo.body).slice(0, 140) || '내용 없음'}
              </p>
              <p className="mt-1.5 text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                {formatMemoDate(memo.updatedAt)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </WidgetCard>
  )
}
