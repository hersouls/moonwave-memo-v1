import type { GamificationState, Badge, Memo } from '@/lib/types'

const MILESTONES = [
  { count: 1, badge: { id: 'first-memo', name: '첫 메모' } },
  { count: 10, badge: { id: '10-memos', name: '메모 10개' } },
  { count: 50, badge: { id: '50-memos', name: '메모 50개' } },
  { count: 100, badge: { id: '100-memos', name: '메모 100개' } },
  { count: 500, badge: { id: '500-memos', name: '메모 500개' } },
]

const STREAK_BADGES = [
  { streak: 3, badge: { id: 'streak-3', name: '3일 연속' } },
  { streak: 7, badge: { id: 'streak-7', name: '7일 연속' } },
  { streak: 30, badge: { id: 'streak-30', name: '30일 연속' } },
]

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

export function calculateStreak(state: GamificationState): GamificationState {
  const today = getDateString()
  const yesterday = getDateString(new Date(Date.now() - 86400000))

  if (state.lastActiveDate === today) {
    return state // Already active today
  }

  let newStreak: number
  if (state.lastActiveDate === yesterday) {
    newStreak = state.currentStreak + 1
  } else {
    newStreak = 1 // Reset streak
  }

  return {
    ...state,
    currentStreak: newStreak,
    longestStreak: Math.max(state.longestStreak, newStreak),
    lastActiveDate: today,
  }
}

export function checkMilestones(
  state: GamificationState,
  totalMemos: number
): { updatedState: GamificationState; newBadges: Badge[] } {
  const newBadges: Badge[] = []
  const now = new Date().toISOString()
  const existingBadgeIds = new Set(state.badges.map((b) => b.id))

  // Check memo count milestones
  for (const milestone of MILESTONES) {
    if (totalMemos >= milestone.count && !existingBadgeIds.has(milestone.badge.id)) {
      newBadges.push({ ...milestone.badge, unlockedAt: now })
    }
  }

  // Check streak milestones
  for (const streakMilestone of STREAK_BADGES) {
    if (state.currentStreak >= streakMilestone.streak && !existingBadgeIds.has(streakMilestone.badge.id)) {
      newBadges.push({ ...streakMilestone.badge, unlockedAt: now })
    }
  }

  if (newBadges.length === 0) return { updatedState: state, newBadges: [] }

  return {
    updatedState: {
      ...state,
      totalMemosCreated: totalMemos,
      badges: [...state.badges, ...newBadges],
    },
    newBadges,
  }
}

export function generateHeatmapData(memos: Memo[], weeks: number = 16): { date: string; count: number }[] {
  const data: { date: string; count: number }[] = []
  const today = new Date()
  const countMap = new Map<string, number>()

  // Count memos by creation date
  memos.forEach((m) => {
    if (!m.deletedAt) {
      const date = m.createdAt.split('T')[0]
      countMap.set(date, (countMap.get(date) || 0) + 1)
    }
  })

  // Generate data for the past N weeks
  const totalDays = weeks * 7
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    const dateStr = getDateString(d)
    data.push({ date: dateStr, count: countMap.get(dateStr) || 0 })
  }

  return data
}
