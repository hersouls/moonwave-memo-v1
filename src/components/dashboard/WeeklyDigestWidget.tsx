import { useMemo } from 'react'
import { FileBarChart, Sparkles, TrendingUp, ArrowRight } from 'lucide-react'
import { startOfWeek, isWithinInterval, parseISO } from 'date-fns'
import { useMemoStore } from '@/stores/memoStore'
import { useAIDigest } from '@/hooks/useAIDigest'
import { WidgetCard } from './WidgetCard'

export function WeeklyDigestWidget() {
  const memos = useMemoStore((s) => s.memos)
  const { digest: aiDigest, isLoading: aiLoading } = useAIDigest()

  const localDigest = useMemo(() => {
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

  if (localDigest.created === 0 && localDigest.edited === 0) return null

  return (
    <WidgetCard
      icon={FileBarChart}
      title="이번 주 요약"
      titleAdornment={aiDigest && <Sparkles className="h-3 w-3 shrink-0 text-amber-400" />}
    >
      <div className="space-y-3">
        {/* AI Summary */}
        {aiDigest?.summary && (
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            {aiDigest.summary}
          </p>
        )}

        {/* Stats */}
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">{localDigest.created}</p>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{'작성'}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-zinc-900 dark:text-zinc-100">{localDigest.edited}</p>
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{'편집'}</p>
          </div>
        </div>

        {/* AI Themes (or fallback to local tags) */}
        {((aiDigest?.themes?.length ? aiDigest.themes : null) || localDigest.topTags).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
              {aiDigest?.themes?.length ? '주요 테마' : '상위 태그'}
            </span>
            {(aiDigest?.themes?.length ? aiDigest.themes : localDigest.topTags).map((item) => (
              <span
                key={item}
                className="rounded-full bg-primary-50 px-2 py-0.5 text-[11px] text-primary-600 dark:bg-primary-900/20 dark:text-primary-400"
              >
                {aiDigest?.themes?.length ? item : `#${item}`}
              </span>
            ))}
          </div>
        )}

        {/* AI Mood Trend */}
        {aiDigest?.moodTrend && (
          <div className="flex items-start gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-zinc-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {aiDigest.moodTrend}
            </p>
          </div>
        )}

        {/* AI Growth */}
        {aiDigest?.growth && (
          <p className="text-xs text-primary-600 dark:text-primary-400 pl-5.5">
            {aiDigest.growth}
          </p>
        )}

        {/* AI Top Insights */}
        {aiDigest?.topInsights && aiDigest.topInsights.length > 0 && (
          <ul className="space-y-1 pl-5.5">
            {aiDigest.topInsights.map((insight, i) => (
              <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-1.5">
                <span className="text-zinc-400 shrink-0">{'·'}</span>
                {insight}
              </li>
            ))}
          </ul>
        )}

        {/* AI Next Week Suggestion */}
        {aiDigest?.nextWeekSuggestion && (
          <div className="flex items-start gap-2 pt-1">
            <ArrowRight className="w-3.5 h-3.5 text-primary-400 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-primary-600 dark:text-primary-400 italic leading-relaxed">
              {aiDigest.nextWeekSuggestion}
            </p>
          </div>
        )}

        {/* Loading indicator */}
        {aiLoading && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{'AI 분석 중...'}</span>
          </div>
        )}
      </div>
    </WidgetCard>
  )
}
