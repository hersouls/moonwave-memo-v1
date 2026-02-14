import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { ActivityLog, ActivityAction } from '@/lib/types'
import {
  getActivityLogs,
  getActivityLogsByDateRange,
  addActivityLog as dbAddActivityLog,
  clearOldActivityLogs,
} from '@/services/database'

interface ActivityState {
  logs: ActivityLog[]
  isLoading: boolean

  initialize: () => Promise<void>
  loadLogs: (limit?: number) => Promise<void>
  loadLogsByDateRange: (start: string, end: string) => Promise<void>
  addLog: (taskId: number, taskTitle: string, action: ActivityAction, details?: string) => Promise<void>
  cleanup: () => Promise<void>
}

export const useActivityStore = create<ActivityState>()(
  devtools(
    (set) => ({
      logs: [],
      isLoading: false,

      initialize: async () => {
        // 90일 이상 된 기록 정리
        await clearOldActivityLogs(90)
        const logs = await getActivityLogs(100)
        set({ logs })
      },

      loadLogs: async (limit = 100) => {
        set({ isLoading: true })
        try {
          const logs = await getActivityLogs(limit)
          set({ logs, isLoading: false })
        } catch {
          set({ isLoading: false })
        }
      },

      loadLogsByDateRange: async (start, end) => {
        set({ isLoading: true })
        try {
          const logs = await getActivityLogsByDateRange(start, end)
          set({ logs, isLoading: false })
        } catch {
          set({ isLoading: false })
        }
      },

      addLog: async (taskId, taskTitle, action, details) => {
        const now = new Date().toISOString()
        const log: Omit<ActivityLog, 'id'> = {
          taskId,
          taskTitle,
          action,
          details,
          date: now.split('T')[0],
          createdAt: now,
        }
        try {
          await dbAddActivityLog(log)
          // 최신 로그를 state 앞에 추가
          set((state) => ({
            logs: [{ ...log, id: Date.now() }, ...state.logs].slice(0, 100),
          }))
        } catch { /* silent */ }
      },

      cleanup: async () => {
        await clearOldActivityLogs(90)
      },
    }),
    { name: 'activity-store' }
  )
)
