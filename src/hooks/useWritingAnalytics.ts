import { useMemo } from 'react'
import { useMemoStore } from '@/stores/memoStore'

interface AnalyticsData {
  hourDistribution: number[]    // 24-element array, memo count per hour
  dayDistribution: number[]     // 7-element array (Sun-Sat)
  totalWords: number
  averageLength: number
  topTags: Array<{ tag: string; count: number }>
  monthlyTrend: Array<{ month: string; count: number }>
}

export function useWritingAnalytics(): AnalyticsData {
  const memos = useMemoStore((s) => s.memos)

  return useMemo(() => {
    const active = memos.filter((m) => !m.deletedAt)
    const hourDist = new Array(24).fill(0)
    const dayDist = new Array(7).fill(0)
    const tagCount = new Map<string, number>()
    const monthMap = new Map<string, number>()
    let totalChars = 0

    for (const memo of active) {
      const d = new Date(memo.createdAt)
      hourDist[d.getHours()]++
      dayDist[d.getDay()]++
      totalChars += memo.body.length

      for (const tag of memo.tags) {
        tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
      }

      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthMap.set(monthKey, (monthMap.get(monthKey) || 0) + 1)
    }

    const topTags = [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    const monthlyTrend = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-6)
      .map(([month, count]) => ({ month, count }))

    return {
      hourDistribution: hourDist,
      dayDistribution: dayDist,
      totalWords: Math.round(totalChars / 3.5),  // Korean: ~3.5 chars per word
      averageLength: active.length > 0 ? Math.round(totalChars / active.length) : 0,
      topTags,
      monthlyTrend,
    }
  }, [memos])
}
