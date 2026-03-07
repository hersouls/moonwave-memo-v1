import { useMemo } from 'react'
import { parseISO } from 'date-fns'
import { useMemoStore } from '@/stores/memoStore'
import { analyzeSentiment, type Mood } from '@/services/sentimentAnalysis'

const MOOD_CONFIG: Record<Mood, { label: string; color: string; bgColor: string; emoji: string }> = {
  positive: {
    label: '\uAE0D\uC815',
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    emoji: '\u{1F60A}',
  },
  neutral: {
    label: '\uC911\uB9BD',
    color: 'bg-zinc-400',
    bgColor: 'bg-zinc-100 dark:bg-zinc-700',
    emoji: '\u{1F610}',
  },
  negative: {
    label: '\uBD80\uC815',
    color: 'bg-rose-500',
    bgColor: 'bg-rose-50 dark:bg-rose-900/20',
    emoji: '\u{1F614}',
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
    <div className="rounded-2xl bg-white shadow-sm dark:bg-zinc-800">
      <div className="flex items-center gap-2.5 px-5 py-3.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-900/20">
          <span className="text-base">{'\u{1F3AF}'}</span>
        </div>
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {'\uAC10\uC815 \uD2B8\uB798\uCEE4'}
        </span>
        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">
          {'\uCD5C\uADFC 30\uC77C'}
        </span>
      </div>
      <div className="border-t border-zinc-100 px-5 py-4 dark:border-zinc-700">
        {/* Horizontal bar */}
        <div className="mb-3 flex h-3 overflow-hidden rounded-full">
          {moodData.counts.positive > 0 && (
            <div
              className="bg-emerald-500 transition-all duration-300"
              style={{ width: `${moodData.percentages.positive}%` }}
            />
          )}
          {moodData.counts.neutral > 0 && (
            <div
              className="bg-zinc-300 transition-all duration-300 dark:bg-zinc-600"
              style={{ width: `${moodData.percentages.neutral}%` }}
            />
          )}
          {moodData.counts.negative > 0 && (
            <div
              className="bg-rose-500 transition-all duration-300"
              style={{ width: `${moodData.percentages.negative}%` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4">
          {(Object.keys(MOOD_CONFIG) as Mood[]).map((mood) => (
            <div key={mood} className="flex items-center gap-1.5">
              <span className="text-sm">{MOOD_CONFIG[mood].emoji}</span>
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                {MOOD_CONFIG[mood].label}
              </span>
              <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">
                {moodData.counts[mood]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
