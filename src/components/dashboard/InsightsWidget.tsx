import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { generateInsights } from '@/services/insightEngine'

const INSIGHT_ICONS: Record<string, string> = {
  pattern: '\uD83D\uDD04',
  streak: '\uD83D\uDD25',
  tag: '\uD83C\uDFF7\uFE0F',
  time: '\u23F0',
}

export function InsightsWidget() {
  const memos = useMemoStore((s) => s.memos)

  const insights = useMemo(() => generateInsights(memos), [memos])

  if (insights.length === 0) return null

  return (
    <div className="rounded-2xl bg-white dark:bg-zinc-800 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
        </div>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {'\uC778\uC0AC\uC774\uD2B8'}
        </span>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-700 px-5 py-4">
        <ul className="space-y-2.5">
          {insights.map((insight, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="text-sm shrink-0 mt-0.5" aria-hidden="true">
                {INSIGHT_ICONS[insight.type] || '\u2022'}
              </span>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {insight.text}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
