import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ThemeMode, ColorPalette, TaskAlertPreferences, CreditCard, UserProfile } from '@/lib/types'
import { encrypt, decrypt } from '@/lib/crypto'
export type { ThemeMode }

interface Settings {
  theme: ThemeMode
  isMusicPlayerEnabled: boolean
  colorPalette: ColorPalette
  lastBackupDate?: string
  alertPreferences: {
    task: TaskAlertPreferences
  }
  googleDrive: {
    isConnected: boolean
    autoBackup: boolean
    lastSyncDate?: string
  }
  browserNotificationsEnabled: boolean
  dailyGoal: number
  aiEnabled: boolean
  aiApiKey: string
  paymentMethods: CreditCard[]
  hasCompletedOnboarding: boolean
  userProfile: UserProfile
}

interface SettingsState {
  settings: Settings
  initialize: () => void
  setTheme: (theme: ThemeMode) => void
  toggleMusicPlayer: () => void
  setColorPalette: (palette: ColorPalette) => void
  setLastBackupDate: (date: Date) => void
  setGoogleDriveStatus: (isConnected: boolean) => void
  toggleAutoBackup: () => void
  setLastSyncDate: (date: Date) => void
  toggleTaskAlert: (key: keyof TaskAlertPreferences) => void
  setBrowserNotifications: (enabled: boolean) => void
  setDailyGoal: (goal: number) => void
  setAiEnabled: (enabled: boolean) => void
  setAiApiKey: (key: string) => Promise<void>
  getDecryptedApiKey: () => Promise<string>
  addCard: (card: CreditCard) => void
  updateCard: (card: CreditCard) => void
  deleteCard: (id: string) => void
  setHasCompletedOnboarding: (completed: boolean) => void
  updateProfile: (profile: Partial<UserProfile>) => void
}

const DEFAULT_ALERT_PREFERENCES: { task: TaskAlertPreferences } = {
  task: {
    dueReminder: true,
    overdueAlert: true,
  },
}

export function applyTheme(theme: ThemeMode) {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  document.documentElement.classList.toggle('dark', isDark)
}

export function applyColorPalette(palette: ColorPalette) {
  const root = document.documentElement
  if (palette === 'default') {
    root.removeAttribute('data-palette')
  } else {
    root.setAttribute('data-palette', palette)
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: {
        theme: 'light',
        isMusicPlayerEnabled: false,
        colorPalette: 'default',
        lastBackupDate: undefined,
        alertPreferences: DEFAULT_ALERT_PREFERENCES,
        googleDrive: {
          isConnected: false,
          autoBackup: false,
        },
        browserNotificationsEnabled: false,
        dailyGoal: 3,
        aiEnabled: false,
        aiApiKey: '',
        paymentMethods: [],
        hasCompletedOnboarding: false,
        userProfile: {
          name: '사용자',
          currentStreak: 0,
        },
      },

      initialize: () => {
        const state = get()
        const { theme, colorPalette } = state.settings

        // Patch missing settings (migration for existing users)
        const newSettings = { ...state.settings }
        let hasChanges = false

        if (!newSettings.googleDrive) {
          newSettings.googleDrive = {
            isConnected: false,
            autoBackup: false,
          }
          hasChanges = true
        }

        if (!newSettings.alertPreferences) {
          newSettings.alertPreferences = DEFAULT_ALERT_PREFERENCES
          hasChanges = true
        }

        if (newSettings.browserNotificationsEnabled === undefined) {
          newSettings.browserNotificationsEnabled = false
          hasChanges = true
        }

        if (newSettings.dailyGoal === undefined) {
          newSettings.dailyGoal = 3
          hasChanges = true
        }

        if (newSettings.aiEnabled === undefined) {
          newSettings.aiEnabled = false
          hasChanges = true
        }

        if (newSettings.aiApiKey === undefined) {
          newSettings.aiApiKey = ''
          hasChanges = true
        }

        if (newSettings.paymentMethods === undefined) {
          newSettings.paymentMethods = []
          hasChanges = true
        }

        if (newSettings.userProfile === undefined) {
          newSettings.userProfile = {
            name: '사용자',
            currentStreak: 0,
          }
          hasChanges = true
        }

        if (hasChanges) {
          set({ settings: newSettings })
        }

        applyTheme(theme)
        applyColorPalette(colorPalette)

        // Listen for system theme changes
        window
          .matchMedia('(prefers-color-scheme: dark)')
          .addEventListener('change', () => {
            if (get().settings.theme === 'system') {
              applyTheme('system')
            }
          })
      },

      setTheme: (theme) => {
        set((state) => ({
          settings: { ...state.settings, theme },
        }))
        applyTheme(theme)
      },

      toggleMusicPlayer: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            isMusicPlayerEnabled: !state.settings.isMusicPlayerEnabled,
          },
        }))
      },

      setColorPalette: (palette) => {
        set((state) => ({
          settings: { ...state.settings, colorPalette: palette },
        }))
        applyColorPalette(palette)
      },

      setLastBackupDate: (date) => {
        set((state) => ({
          settings: { ...state.settings, lastBackupDate: date.toISOString() },
        }))
      },

      setGoogleDriveStatus: (isConnected) => {
        set((state) => ({
          settings: {
            ...state.settings,
            googleDrive: {
              ...(state.settings.googleDrive || { autoBackup: false }),
              isConnected,
            },
          },
        }))
      },

      toggleAutoBackup: () => {
        set((state) => ({
          settings: {
            ...state.settings,
            googleDrive: {
              ...(state.settings.googleDrive || { isConnected: false }),
              autoBackup: !(state.settings.googleDrive?.autoBackup),
            },
          },
        }))
      },

      setLastSyncDate: (date) => {
        set((state) => ({
          settings: {
            ...state.settings,
            googleDrive: {
              ...state.settings.googleDrive,
              lastSyncDate: date.toISOString(),
            },
          },
        }))
      },

      toggleTaskAlert: (key) => {
        set((state) => ({
          settings: {
            ...state.settings,
            alertPreferences: {
              ...state.settings.alertPreferences,
              task: {
                ...state.settings.alertPreferences.task,
                [key]: !state.settings.alertPreferences.task[key],
              },
            },
          },
        }))
      },

      setBrowserNotifications: (enabled) => {
        set((state) => ({
          settings: {
            ...state.settings,
            browserNotificationsEnabled: enabled,
          },
        }))
      },

      setDailyGoal: (goal) => {
        set((state) => ({
          settings: {
            ...state.settings,
            dailyGoal: Math.max(1, Math.min(20, goal)),
          },
        }))
      },

      setAiEnabled: (enabled) => {
        set((state) => ({
          settings: { ...state.settings, aiEnabled: enabled },
        }))
      },

      setAiApiKey: async (key) => {
        const encrypted = await encrypt(key)
        set((state) => ({
          settings: { ...state.settings, aiApiKey: encrypted },
        }))
      },

      getDecryptedApiKey: async () => {
        const { aiApiKey } = get().settings
        if (!aiApiKey) return ''
        return decrypt(aiApiKey)
      },

      addCard: (card) => {
        set((state) => ({
          settings: {
            ...state.settings,
            paymentMethods: [...(state.settings.paymentMethods || []), card],
          },
        }))
      },

      updateCard: (updatedCard) => {
        set((state) => ({
          settings: {
            ...state.settings,
            paymentMethods: state.settings.paymentMethods.map((c) =>
              c.id === updatedCard.id ? updatedCard : c
            ),
          },
        }))
      },

      deleteCard: (id) => {
        set((state) => ({
          settings: {
            ...state.settings,
            paymentMethods: state.settings.paymentMethods.filter((c) => c.id !== id),
          },
        }))
      },

      setHasCompletedOnboarding: (completed) => {
        set((state) => ({
          settings: { ...state.settings, hasCompletedOnboarding: completed },
        }))
      },

      updateProfile: (profile) => {
        set((state) => ({
          settings: {
            ...state.settings,
            userProfile: { ...state.settings.userProfile, ...profile },
          },
        }))
      },
    }),
    {
      name: 'todo-settings',
    }
  )
)
