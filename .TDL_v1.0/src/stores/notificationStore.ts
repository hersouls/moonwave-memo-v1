// ============================================
// Notification Store (Zustand)
// TDL_v1.0 - Task & Backup Notifications
// ============================================

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { AppNotification, NotificationType, TaskAlertPreferences } from '@/lib/types'
import { getOverdueTasks, getTasksByDate } from '@/services/database'
import { showBrowserNotification } from '@/services/browserNotification'

// Constants
const MAX_NOTIFICATIONS = 50
const BACKUP_REMINDER_DAYS = 7
const NOTIFICATION_COOLDOWN_MS = 24 * 60 * 60 * 1000 // 24 hours
const NOTIFICATION_EXPIRY_DAYS = 7

// Default alert preferences
const DEFAULT_TASK_ALERT_PREFERENCES: TaskAlertPreferences = {
  dueReminder: true,
  overdueAlert: true,
}

// Get notification preferences from settings store
function getAlertPreferences(): { task: TaskAlertPreferences } {
  try {
    const settingsData = localStorage.getItem('todo-settings')
    if (settingsData) {
      const parsed = JSON.parse(settingsData)
      return parsed?.state?.settings?.alertPreferences || { task: DEFAULT_TASK_ALERT_PREFERENCES }
    }
  } catch {
    // Ignore parse errors
  }
  return { task: DEFAULT_TASK_ALERT_PREFERENCES }
}

// Map notification type to preference key
function isNotificationEnabled(type: NotificationType): boolean {
  const prefs = getAlertPreferences()

  const taskAlertMap: Record<string, keyof TaskAlertPreferences> = {
    'task-due': 'dueReminder',
    'task-overdue': 'overdueAlert',
    'task-reminder': 'dueReminder',
  }

  if (type in taskAlertMap) return prefs.task?.[taskAlertMap[type]] ?? true
  // backup-reminder and streak-milestone are always enabled
  return true
}

// Generate unique notification key for deduplication
function getNotificationKey(type: NotificationType, taskId?: number): string {
  return `${type}-${taskId || 'global'}`
}

interface NotificationState {
  notifications: AppNotification[]
  lastTriggered: Record<string, number>

  // Core actions
  addNotification: (notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  removeNotification: (id: string) => void
  clearAll: () => void
  cleanupExpired: () => void

  // Trigger checks
  checkTaskDueNotifications: () => Promise<void>
  checkOverdueNotifications: () => Promise<void>
  checkBackupReminder: (lastBackupDate?: string) => void
}

export const useNotificationStore = create<NotificationState>()(
  devtools(
    persist(
      (set, get) => ({
        notifications: [],
        lastTriggered: {},

        addNotification: (notification) => {
          // Check if this notification type is enabled
          if (!isNotificationEnabled(notification.type)) {
            return
          }

          const key = getNotificationKey(notification.type, notification.taskId)
          const now = Date.now()

          // Check cooldown
          const lastTrigger = get().lastTriggered[key]
          if (lastTrigger && now - lastTrigger < NOTIFICATION_COOLDOWN_MS) {
            return
          }

          // Skip if unread notification with same key exists
          const existing = get().notifications.find(
            (n) => !n.read && getNotificationKey(n.type, n.taskId) === key
          )
          if (existing) return

          const newNotification: AppNotification = {
            ...notification,
            id: crypto.randomUUID(),
            createdAt: new Date(),
            read: false,
          }

          set((state) => {
            const updated = [newNotification, ...state.notifications]
            const newLastTriggered = { ...state.lastTriggered, [key]: now }

            if (updated.length > MAX_NOTIFICATIONS) {
              return {
                notifications: updated.slice(0, MAX_NOTIFICATIONS),
                lastTriggered: newLastTriggered,
              }
            }

            return { notifications: updated, lastTriggered: newLastTriggered }
          })

          // Browser notification (if enabled)
          try {
            const settingsData = localStorage.getItem('todo-settings')
            const settings = settingsData ? JSON.parse(settingsData)?.state?.settings : null

            if (settings?.browserNotificationsEnabled) {
              showBrowserNotification(notification.title, notification.message, {
                tag: key,
              })
            }
          } catch {
            // Ignore browser notification errors
          }
        },

        markAsRead: (id) => {
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          }))
        },

        markAllAsRead: () => {
          set((state) => ({
            notifications: state.notifications.map((n) => ({ ...n, read: true })),
          }))
        },

        removeNotification: (id) => {
          set((state) => ({
            notifications: state.notifications.filter((n) => n.id !== id),
          }))
        },

        clearAll: () => {
          set({ notifications: [], lastTriggered: {} })
        },

        cleanupExpired: () => {
          const expiryMs = NOTIFICATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000
          const now = Date.now()

          set((state) => {
            const validNotifications = state.notifications.filter((n) => {
              const createdTime = new Date(n.createdAt).getTime()
              return now - createdTime < expiryMs
            })

            const validLastTriggered: Record<string, number> = {}
            for (const [key, timestamp] of Object.entries(state.lastTriggered)) {
              if (now - timestamp < expiryMs) {
                validLastTriggered[key] = timestamp
              }
            }

            return {
              notifications: validNotifications,
              lastTriggered: validLastTriggered,
            }
          })
        },

        checkTaskDueNotifications: async () => {
          const { addNotification } = get()

          try {
            const today = new Date().toISOString().split('T')[0]
            const tasksDueToday = await getTasksByDate(today)
            const pendingDueToday = tasksDueToday.filter((t) => t.status === 'pending')

            for (const task of pendingDueToday) {
              addNotification({
                type: 'task-due',
                title: '오늘 마감',
                message: `"${task.title}" 할 일이 오늘 마감입니다.`,
                taskId: task.id,
              })
            }
          } catch {
            // Error checking task due notifications
          }
        },

        checkOverdueNotifications: async () => {
          const { addNotification } = get()

          try {
            const overdueTasks = await getOverdueTasks()

            for (const task of overdueTasks) {
              addNotification({
                type: 'task-overdue',
                title: '기한 초과',
                message: `"${task.title}" 할 일이 기한을 초과했습니다. (마감: ${task.dueDate})`,
                taskId: task.id,
              })
            }
          } catch {
            // Error checking overdue notifications
          }
        },

        checkBackupReminder: (lastBackupDate) => {
          const { addNotification } = get()

          if (!lastBackupDate) {
            addNotification({
              type: 'backup-reminder',
              title: '백업 알림',
              message: '데이터 백업을 한 번도 하지 않았습니다. 백업을 권장합니다.',
            })
            return
          }

          const daysSinceBackup = Math.floor(
            (Date.now() - new Date(lastBackupDate).getTime()) / (1000 * 60 * 60 * 24)
          )

          if (daysSinceBackup >= BACKUP_REMINDER_DAYS) {
            addNotification({
              type: 'backup-reminder',
              title: '백업 알림',
              message: `마지막 백업 후 ${daysSinceBackup}일이 경과했습니다.`,
            })
          }
        },
      }),
      {
        name: 'todo-notifications',
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name)
            if (!str) return null

            const data = JSON.parse(str)
            if (data.state?.notifications) {
              data.state.notifications = data.state.notifications.map(
                (n: AppNotification) => ({
                  ...n,
                  createdAt: new Date(n.createdAt),
                })
              )
            }
            return data
          },
          setItem: (name, value) => {
            localStorage.setItem(name, JSON.stringify(value))
          },
          removeItem: (name) => {
            localStorage.removeItem(name)
          },
        },
      }
    ),
    { name: 'notification-store' }
  )
)

// Selectors
const selectUnreadCount = (state: NotificationState) =>
  state.notifications.filter((n) => !n.read).length

export function useUnreadCount() {
  return useNotificationStore(selectUnreadCount)
}
