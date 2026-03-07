import type { Memo } from '@/lib/types'

export interface Insight {
  text: string
  type: 'pattern' | 'streak' | 'tag' | 'time'
}

const DAY_NAMES = ['\uC77C\uC694\uC77C', '\uC6D4\uC694\uC77C', '\uD654\uC694\uC77C', '\uC218\uC694\uC77C', '\uBAA9\uC694\uC77C', '\uAE08\uC694\uC77C', '\uD1A0\uC694\uC77C']
const HOUR_LABELS: Record<string, string> = {
  morning: '\uC624\uC804 6-12\uC2DC',
  afternoon: '\uC624\uD6C4 12-18\uC2DC',
  evening: '\uC800\uB141 18-24\uC2DC',
  night: '\uC0C8\uBCBD 0-6\uC2DC',
}

export function generateInsights(memos: Memo[]): Insight[] {
  const active = memos.filter((m) => !m.deletedAt)
  if (active.length < 3) return []

  const insights: Insight[] = []

  // 1. Detect recurring tags (used 3+ times)
  const tagCounts = new Map<string, number>()
  for (const memo of active) {
    for (const tag of memo.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    }
  }

  const recurringTags = [...tagCounts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])

  if (recurringTags.length > 0) {
    const top = recurringTags[0]
    insights.push({
      text: `#${top[0]} \uD0DC\uADF8\uB97C ${top[1]}\uD68C \uC0AC\uC6A9\uD588\uC2B5\uB2C8\uB2E4. \uC790\uC8FC \uB2E4\uB8E8\uB294 \uC8FC\uC81C\uC785\uB2C8\uB2E4.`,
      type: 'tag',
    })
  }

  // 2. Find common writing time patterns
  const hourBuckets = { morning: 0, afternoon: 0, evening: 0, night: 0 }
  for (const memo of active) {
    const hour = new Date(memo.createdAt).getHours()
    if (hour >= 6 && hour < 12) hourBuckets.morning++
    else if (hour >= 12 && hour < 18) hourBuckets.afternoon++
    else if (hour >= 18) hourBuckets.evening++
    else hourBuckets.night++
  }

  const maxPeriod = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0]
  if (maxPeriod[1] > active.length * 0.4) {
    insights.push({
      text: `\uC8FC\uB85C ${HOUR_LABELS[maxPeriod[0]]}\uC5D0 \uBA54\uBAA8\uB97C \uC791\uC131\uD569\uB2C8\uB2E4.`,
      type: 'time',
    })
  }

  // Day of week pattern
  const dayCounts = new Array(7).fill(0)
  for (const memo of active) {
    dayCounts[new Date(memo.createdAt).getDay()]++
  }
  const maxDay = dayCounts.indexOf(Math.max(...dayCounts))
  const maxDayRatio = dayCounts[maxDay] / active.length
  if (maxDayRatio > 0.25) {
    insights.push({
      text: `${DAY_NAMES[maxDay]}\uC5D0 \uAC00\uC7A5 \uB9CE\uC774 \uC791\uC131\uD569\uB2C8\uB2E4 (${dayCounts[maxDay]}\uAC1C).`,
      type: 'pattern',
    })
  }

  // 3. Calculate streak info
  const dates = new Set<string>()
  for (const memo of active) {
    const d = new Date(memo.createdAt)
    dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  let currentStreak = 0
  const today = new Date()
  const checkDate = new Date(today)

  while (currentStreak < 365) {
    const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`
    if (dates.has(key)) {
      currentStreak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else {
      break
    }
  }

  if (currentStreak >= 3) {
    insights.push({
      text: `${currentStreak}\uC77C \uC5F0\uC18D \uBA54\uBAA8\uB97C \uC791\uC131\uD558\uACE0 \uC788\uC2B5\uB2C8\uB2E4!`,
      type: 'streak',
    })
  }

  // 4. Average memo length trend
  const recentMemos = active
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)

  if (recentMemos.length > 5) {
    const recentAvg = recentMemos.slice(0, 5).reduce((sum, m) => sum + m.body.length, 0) / 5
    const olderAvg = recentMemos.slice(5).reduce((sum, m) => sum + m.body.length, 0) / Math.min(5, recentMemos.length - 5)

    if (recentAvg > olderAvg * 1.3) {
      insights.push({
        text: '\uCD5C\uADFC \uBA54\uBAA8\uAC00 \uC774\uC804\uBCF4\uB2E4 \uB354 \uAE38\uC5B4\uC9C0\uACE0 \uC788\uC2B5\uB2C8\uB2E4.',
        type: 'pattern',
      })
    }
  }

  return insights.slice(0, 5)
}
