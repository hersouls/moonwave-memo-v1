import { useMemo } from 'react'
import { Newspaper, FileText, CheckSquare, Target, Sparkles, Heart, Lightbulb } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { parseChecklist } from '@/utils/checklistParser'
import { useAIBriefing } from '@/hooks/useAIBriefing'
import { WidgetCard } from './WidgetCard'

export function BriefingWidget() {
  const memos = useMemoStore((s) => s.memos)
  const { briefing: aiBriefing, isLoading: aiLoading } = useAIBriefing()

  const localBriefing = useMemo(() => {
    const now = new Date()
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
      suggestedFocus = `#${topTag[0]} 관련 메모를 이어가 보세요`
    }

    return {
      yesterdayCount: yesterdayMemos.length,
      pendingTodos,
      suggestedFocus,
    }
  }, [memos])

  return (
    <WidgetCard
      icon={Newspaper}
      tint="amber"
      title="오늘의 브리핑"
      titleAdornment={aiBriefing && <Sparkles className="h-3 w-3 shrink-0 text-amber-400" />}
    >
      <div className="space-y-3">
        {/* AI Greeting */}
        {aiBriefing?.greeting && (
          <div className="flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {aiBriefing.greeting}
            </p>
          </div>
        )}

        {/* AI Mood Summary */}
        {aiBriefing?.moodSummary && (
          <div className="flex items-start gap-3">
            <Heart className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {aiBriefing.moodSummary}
            </p>
          </div>
        )}

        {/* Fallback: Yesterday's memo count (shown when no AI greeting and not loading) */}
        {!aiLoading && !aiBriefing?.greeting && (
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {'어제'}{' '}
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                {localBriefing.yesterdayCount}{'개'}
              </span>
              {'의 메모를 작성했습니다'}
            </p>
          </div>
        )}

        {/* Pending TODOs */}
        {localBriefing.pendingTodos > 0 && (
          <div className="flex items-center gap-3">
            <CheckSquare className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {'미완료 TODO'}{' '}
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {localBriefing.pendingTodos}{'개'}
              </span>
              {'가 남아있습니다'}
            </p>
          </div>
        )}

        {/* AI Today Focus or Fallback */}
        {(aiBriefing?.todayFocus || localBriefing.suggestedFocus) && (
          <div className="flex items-start gap-3">
            <Target className="w-4 h-4 text-primary-500 shrink-0 mt-0.5" />
            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {aiBriefing?.todayFocus || localBriefing.suggestedFocus}
            </p>
          </div>
        )}

        {/* AI Key Topics */}
        {aiBriefing?.keyTopics && aiBriefing.keyTopics.length > 0 && (
          <div className="flex items-start gap-3">
            <Lightbulb className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="flex flex-wrap gap-1.5">
              {aiBriefing.keyTopics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI Encouragement */}
        {aiBriefing?.encouragement && (
          <p className="text-xs text-amber-600 dark:text-amber-400 italic pl-7">
            {aiBriefing.encouragement}
          </p>
        )}

        {/* Loading indicator */}
        {aiLoading && (
          <div className="flex items-center gap-2 pl-7">
            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{'AI 분석 중...'}</span>
          </div>
        )}
      </div>
    </WidgetCard>
  )
}
