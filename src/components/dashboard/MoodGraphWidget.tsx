import { useMemo } from 'react'
import { parseISO } from 'date-fns'
import { HeartPulse, Smile, Meh, Frown, type LucideIcon } from 'lucide-react'
import { useMemoStore } from '@/stores/memoStore'
import { analyzeSentiment, type Mood } from '@/services/sentimentAnalysis'
import { WidgetCard } from './WidgetCard'

/* 감정 색은 데이터 의미 색상(emerald/rose) — 액센트 규율의 예외 허용 범위 */
const MOOD_CONFIG: Record<Mood, { label: string; color: string; icon: LucideIcon; iconColor: string }> = {
  positive: {
    label: '긍정',
    color: 'bg-emerald-500',
    icon: Smile,
    iconColor: 'text-emerald-500',
  },
  neutral: {
    label: '중립',
    color: 'bg-zinc-300 dark:bg-zinc-600',
    icon: Meh,
    iconColor: 'text-zinc-400',
  },
  negative: {
    label: '부정',
    color: 'bg-rose-500',
    icon: Frown,
    iconColor: 'text-rose-500',
  },
}

export function MoodGraphWidget() {
  const memos = useMemoStore((s) => s.memos)

  const moodData = useMemo(() => {
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const recentMemos = memos.filter(
      (m) => !m.deletedAt && parseISO(m.createdAt) >= thirtyDaysAgo
    )

    if (recentMemos.length === 0) return null

    const counts: Record<Mood, number> = { positive: 0, neutral: 0, negative: 0 }

    recentMemos.forEach((m) => {
      const text = `${m.title} ${m.body}`
      const mood = analyzeSentiment(text)
      counts[mood]++
    })

    const total = recentMemos.length

    return {
      counts,
      total,
      percentages: {
        positive: Math.round((counts.positive / total) * 100),
        neutral: Math.round((counts.neutral / total) * 100),
        negative: Math.round((counts.negative / total) * 100),
      },
    }
  }, [memos])

  if (!moodData) return null

  return (
    <WidgetCard icon={HeartPulse} title="감정 트래커" meta="최근 30일">
      {/* Horizontal bar */}
      <div className="mb-3 flex h-3 overflow-hidden rounded-full">
        {(Object.keys(MOOD_CONFIG) as Mood[]).map((mood) =>
          moodData.counts[mood] > 0 ? (
            <div
              key={mood}
              className={`${MOOD_CONFIG[mood].color} transition-all duration-300`}
              style={{ width: `${moodData.percentages[mood]}%` }}
            />
          ) : null
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4">
        {(Object.keys(MOOD_CONFIG) as Mood[]).map((mood) => {
          const { label, icon: Icon, iconColor } = MOOD_CONFIG[mood]
          return (
            <div key={mood} className="flex items-center gap-1.5">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${iconColor}`} aria-hidden="true" />
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                {label}
              </span>
              <span className="text-[11px] font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {moodData.counts[mood]}
              </span>
            </div>
          )
        })}
      </div>
    </WidgetCard>
  )
}
