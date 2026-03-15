const STORAGE_KEY = 'memo-ai-usage'

export const AI_DAILY_LIMIT = 50

interface DailyUsage {
  date: string
  count: number
}

function today(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
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
