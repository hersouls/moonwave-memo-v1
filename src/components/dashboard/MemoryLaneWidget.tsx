import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, Sparkles } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { formatMemoDate } from '@/utils/format'
import { stripMarkdown } from '@/utils/textUtils'

export function MemoryLaneWidget() {
  const navigate = useNavigate()
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
    <div className="card p-4">
      {anniversaryMemos.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2.5">
            <Calendar className="h-4 w-4 text-primary-500" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">이 날의 추억</span>
          </div>
          <div className="space-y-2">
            {anniversaryMemos.map((memo) => (
              <button
                key={memo.id}
                onClick={() => navigate(`/memo/${memo.id}`)}
                className="w-full text-left px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-700/50 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                  {memo.title || '제목 없음'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  {new Date(memo.createdAt).getFullYear()}년 ·{' '}
                  {stripMarkdown(memo.body).slice(0, 40)}
                  {memo.body.length > 40 ? '...' : ''}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {randomRediscovery && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">다시 발견하기</span>
          </div>
          <button
            onClick={() => navigate(`/memo/${randomRediscovery.id}`)}
            className="w-full text-left px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/20 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
          >
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
              {randomRediscovery.title || '제목 없음'}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {formatMemoDate(randomRediscovery.createdAt)} ·{' '}
              {stripMarkdown(randomRediscovery.body).slice(0, 40)}
              {randomRediscovery.body.length > 40 ? '...' : ''}
            </p>
          </button>
        </div>
      )}
    </div>
  )
}
