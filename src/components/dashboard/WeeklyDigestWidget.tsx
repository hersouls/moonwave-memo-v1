import { useMemo } from 'react'
import { FileBarChart } from 'lucide-react'
import { startOfWeek, isWithinInterval, parseISO } from 'date-fns'
import { useMemoStore } from '@/stores/memoStore'

export function WeeklyDigestWidget() {
  const memos = useMemoStore((s) => s.memos)

  const digest = useMemo(() => {
    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 0 })
    const weekEnd = now

    const activeMemos = memos.filter((m) => !m.deletedAt)

    const createdThisWeek = activeMemos.filter((m) =>
      isWithinInterval(parseISO(m.createdAt), { start: weekStart, end: weekEnd })
    )

    const editedThisWeek = activeMemos.filter(
      (m) =>
        isWithinInterval(parseISO(m.updatedAt), { start: weekStart, end: weekEnd }) &&
        m.createdAt !== m.updatedAt
    )

    // Most-used tags this week
    const tagCounts = new Map<string, number>()
    createdThisWeek.forEach((m) => {
      m.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })
    editedThisWeek.forEach((m) => {
      m.tags.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
      })
    })

    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag)

    return {
      created: createdThisWeek.length,
      edited: editedThisWeek.length,
      topTags,
    }
  }, [memos])

  if (digest.created === 0 && digest.edited === 0) return null

  return (
    <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-800">
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-900/20">
          <FileBarChart className="h-4 w-4 text-violet-500" />
        </div>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {'\uC774\uBC88 \uC8FC \uC694\uC57D'}
        </span>
      </div>
      <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-700">
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{digest.created}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{'\uC791\uC131'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{digest.edited}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{'\uD3B8\uC9D1'}</p>
          </div>
        </div>
        {digest.topTags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {'\uC0C1\uC704 \uD0DC\uADF8'}
            </span>
            {digest.topTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] text-violet-600 dark:bg-violet-900/20 dark:text-violet-400"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
