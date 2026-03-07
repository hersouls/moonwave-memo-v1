import { useMemo } from 'react'
import { Newspaper, FileText, CheckSquare, Target } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { parseChecklist } from '@/utils/checklistParser'

export function BriefingWidget() {
  const memos = useMemoStore((s) => s.memos)

  const briefing = useMemo(() => {
    const now = new Date()
    const todayStr = now.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })

    const activeMemos = memos.filter((m) => !m.deletedAt)

    // Yesterday's memos
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate())
    const yesterdayEnd = new Date(yesterdayStart)
    yesterdayEnd.setDate(yesterdayEnd.getDate() + 1)

    const yesterdayMemos = activeMemos.filter((m) => {
      const d = new Date(m.createdAt)
      return d >= yesterdayStart && d < yesterdayEnd
    })

    // Pending TODOs
    let pendingTodos = 0
    for (const memo of activeMemos) {
      const items = parseChecklist(memo.body)
      pendingTodos += items.filter((item) => !item.checked).length
    }

    // Suggested focus: most used tag in last 7 days
    const weekAgo = new Date(Date.now() - 7 * 86400000)
    const recentTags = new Map<string, number>()
    activeMemos
      .filter((m) => new Date(m.createdAt) >= weekAgo)
      .forEach((m) => {
        m.tags.forEach((tag) => {
          recentTags.set(tag, (recentTags.get(tag) || 0) + 1)
        })
      })

    let suggestedFocus = ''
    if (recentTags.size > 0) {
      const topTag = [...recentTags.entries()].sort((a, b) => b[1] - a[1])[0]
      suggestedFocus = `#${topTag[0]} \uAD00\uB828 \uBA54\uBAA8\uB97C \uC774\uC5B4\uAC00 \uBCF4\uC138\uC694`
    }

    return {
      todayStr,
      yesterdayCount: yesterdayMemos.length,
      pendingTodos,
      suggestedFocus,
    }
  }, [memos])

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <Newspaper className="h-4 w-4 text-amber-500" />
        </div>
        <div className="flex-1">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {'\uC624\uB298\uC758 \uBE0C\uB9AC\uD551'}
          </span>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
            {briefing.todayStr}
          </p>
        </div>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-700 px-5 py-4 space-y-3">
        {/* Yesterday's memo count */}
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            {'\uC5B4\uC81C'}{' '}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {briefing.yesterdayCount}\uAC1C
            </span>
            {'\uC758 \uBA54\uBAA8\uB97C \uC791\uC131\uD588\uC2B5\uB2C8\uB2E4'}
          </p>
        </div>

        {/* Pending TODOs */}
        {briefing.pendingTodos > 0 && (
          <div className="flex items-center gap-3">
            <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {'\uBBF8\uC644\uB8CC TODO'}{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {briefing.pendingTodos}\uAC1C
              </span>
              {'\uAC00 \uB0A8\uC544\uC788\uC2B5\uB2C8\uB2E4'}
            </p>
          </div>
        )}

        {/* Suggested focus */}
        {briefing.suggestedFocus && (
          <div className="flex items-center gap-3">
            <Target className="w-4 h-4 text-primary-500 shrink-0" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {briefing.suggestedFocus}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
