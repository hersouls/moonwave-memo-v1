import type { Memo } from '@/lib/types'

export function scoreMemoRelevance(memo: Memo, currentHour: number, currentDay: number): number {
  const accessLog = memo.accessLog
  if (!accessLog || accessLog.length < 3) return 0 // Need minimum access history

  let hourScore = 0
  let dayScore = 0
  let recencyScore = 0
  const now = Date.now()

  for (const entry of accessLog) {
    const t = new Date(entry.timestamp)
    const entryHour = t.getHours()
    const entryDay = t.getDay()
    const daysSinceAccess = (now - t.getTime()) / (1000 * 60 * 60 * 24)

    // Hour proximity (+/-2 hours)
    const hourDiff = Math.abs(entryHour - currentHour)
    if (hourDiff <= 2 || hourDiff >= 22) hourScore += 1

    // Day of week match
    if (entryDay === currentDay) dayScore += 1

    // Recency boost (exponential decay over 30 days)
    recencyScore += Math.exp(-daysSinceAccess / 30)
  }

  const total = accessLog.length
  return (hourScore / total) * 0.4 + (dayScore / total) * 0.3 + (recencyScore / total) * 0.2 + 0.1
}

export function findBestContextMemo(memos: Memo[]): Memo | null {
  const now = new Date()
  const currentHour = now.getHours()
  const currentDay = now.getDay()

  let bestMemo: Memo | null = null
  let bestScore = 0.6 // minimum threshold

  for (const memo of memos) {
    if (memo.deletedAt || !memo.accessLog || memo.accessLog.length < 3) continue
    const score = scoreMemoRelevance(memo, currentHour, currentDay)
    if (score > bestScore) {
      bestScore = score
      bestMemo = memo
    }
  }
  return bestMemo
}
