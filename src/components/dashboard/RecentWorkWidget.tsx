import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { formatMemoDate } from '@/utils/format'
import { stripMarkdown } from '@/utils/textUtils'
import { useViewTransition } from '@/hooks/useViewTransition'
import { WidgetCard } from './WidgetCard'

export function RecentWorkWidget() {
  const navigate = useNavigate()
  const { navigateWithTransition } = useViewTransition()
  const memos = useMemoStore((s) => s.memos)

  const recentMemos = memos
    .filter((m) => !m.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)

  if (recentMemos.length === 0) return null

  return (
    <WidgetCard
      icon={Clock}
      tint="primary"
      title="최근 작업"
      action={
        <button
          type="button"
          onClick={() => navigateWithTransition('/memos')}
          className="flex items-center gap-0.5 rounded-md px-2 py-1.5 text-xs font-medium text-primary-600 transition-colors hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-900/20"
        >
          전체보기
          <ChevronRight className="h-3 w-3" />
        </button>
      }
      bodyClassName="p-0"
    >
      <div className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
        {recentMemos.map((memo) => (
          <button
            key={memo.id}
            onClick={() => navigate(`/memo/${memo.id}`)}
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
            <span className="text-[10px] tabular-nums text-zinc-500 dark:text-zinc-400 shrink-0">
              {formatMemoDate(memo.updatedAt)}
            </span>
          </button>
        ))}
      </div>
    </WidgetCard>
  )
}
