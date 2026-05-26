import { useNavigate } from 'react-router-dom'
import { Clock, ChevronRight } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { formatMemoDate } from '@/utils/format'
import { stripMarkdown } from '@/utils/textUtils'

export function RecentWorkWidget() {
  const navigate = useNavigate()
  const memos = useMemoStore((s) => s.memos)

  const recentMemos = memos
    .filter((m) => !m.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3)

  if (recentMemos.length === 0) return null

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-900/20">
            <Clock className="h-4 w-4 text-primary-500" />
          </div>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">최근 작업</span>
        </div>
        <button
          onClick={() => navigate('/memos')}
          className="flex items-center gap-0.5 text-xs text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          전체보기
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="border-t border-zinc-100 dark:border-zinc-700 divide-y divide-zinc-100 dark:divide-zinc-700">
        {recentMemos.map((memo) => (
          <button
            key={memo.id}
            onClick={() => navigate(`/memo/${memo.id}`)}
            className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {memo.title || '제목 없음'}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                {stripMarkdown(memo.body).slice(0, 60) || '내용 없음'}
              </p>
            </div>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">
              {formatMemoDate(memo.updatedAt)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
