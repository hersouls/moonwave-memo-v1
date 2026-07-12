const STORAGE_KEY = 'memo-ai-usage'

export const AI_DAILY_LIMIT = 50

interface DailyUsage {
  date: string
  count: number
}

function today(): string {
  // Local calendar date, not UTC. toISOString() is UTC, so for KST (UTC+9) users the
  // "day" would roll at 09:00 local — a user who hits the limit at night stays blocked
  // through the next morning. 'en-CA' yields YYYY-MM-DD in the local timezone.
  return new Date().toLocaleDateString('en-CA')
}

export function getAIDailyUsage(): DailyUsage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { date: today(), count: 0 }
    const data: DailyUsage = JSON.parse(raw)
    // Reset if different day
    if (data.date !== today()) return { date: today(), count: 0 }
    return data
  } catch {
    return { date: today(), count: 0 }
  }
}

export function incrementAIUsage(): number {
  const usage = getAIDailyUsage()
  const newUsage: DailyUsage = {
    date: today(),
    count: usage.count + 1,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUsage))
  } catch { /* storage full */ }
  return newUsage.count
}

export function isAILimitReached(): boolean {
  return getAIDailyUsage().count >= AI_DAILY_LIMIT
}

export function getAIRemainingCount(): number {
  return Math.max(0, AI_DAILY_LIMIT - getAIDailyUsage().count)
}
