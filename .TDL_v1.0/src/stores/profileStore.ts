import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, TaskStats } from '@/lib/types'
import { db } from '@/services/database'

interface ProfileState {
  profile: UserProfile
  stats: TaskStats

  // Actions
  initialize: () => Promise<void>
  updateProfile: (updates: Partial<UserProfile>) => void
  refreshStats: () => Promise<void>
  calculateStreak: () => Promise<number>
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: {
        name: '사용자',
        currentStreak: 0,
      },

      stats: {
        completedCount: 0,
        pendingCount: 0,
        currentStreak: 0,
      },

      initialize: async () => {
        await get().refreshStats()
        const streak = await get().calculateStreak()
        set((state) => ({
          profile: { ...state.profile, currentStreak: streak },
          stats: { ...state.stats, currentStreak: streak },
        }))
      },

      updateProfile: (updates) => {
        set((state) => ({
          profile: { ...state.profile, ...updates },
        }))
      },

      refreshStats: async () => {
        try {
          const completedCount = await db.tasks
            .where('status')
            .equals('completed')
            .count()

          const pendingCount = await db.tasks
            .where('status')
            .equals('pending')
            .count()

          const currentStreak = get().stats.currentStreak

          set({
            stats: {
              completedCount,
              pendingCount,
              currentStreak,
            },
          })
        } catch {
          // Error refreshing stats
        }
      },

      calculateStreak: async () => {
        try {
          const logs = await db.completionLogs.orderBy('date').reverse().toArray()

          if (logs.length === 0) {
            set((state) => ({
              profile: { ...state.profile, currentStreak: 0 },
              stats: { ...state.stats, currentStreak: 0 },
            }))
            return 0
          }

          // Get unique dates sorted descending
          const uniqueDates = [...new Set(logs.map((l) => l.date))].sort(
            (a, b) => b.localeCompare(a)
          )

          const today = new Date()
          today.setHours(0, 0, 0, 0)
          const todayStr = today.toISOString().split('T')[0]

          // Check if latest completion is today or yesterday
          const latestDate = uniqueDates[0]
          const yesterday = new Date(today)
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStr = yesterday.toISOString().split('T')[0]

          if (latestDate !== todayStr && latestDate !== yesterdayStr) {
            // Streak broken
            set((state) => ({
              profile: { ...state.profile, currentStreak: 0 },
              stats: { ...state.stats, currentStreak: 0 },
            }))
            return 0
          }

          // Count consecutive days
          let streak = 0
          let checkDate = latestDate === todayStr ? today : yesterday

          for (const dateStr of uniqueDates) {
            const expectedStr = checkDate.toISOString().split('T')[0]
            if (dateStr === expectedStr) {
              streak++
              checkDate.setDate(checkDate.getDate() - 1)
            } else if (dateStr < expectedStr) {
              // Gap found, streak ends
              break
            }
          }

          set((state) => ({
            profile: { ...state.profile, currentStreak: streak },
            stats: { ...state.stats, currentStreak: streak },
          }))

          return streak
        } catch {
          return 0
        }
      },
    }),
    {
      name: 'todo-profile',
      partialize: (state) => ({
        profile: state.profile,
      }),
    }
  )
)
