import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore } from '@/stores/settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset to defaults
    useSettingsStore.setState({
      settings: {
        theme: 'light',
        isMusicPlayerEnabled: false,
        colorPalette: 'default',
        lastBackupDate: undefined,
        alertPreferences: {
          task: { dueReminder: true, overdueAlert: true },
        },
        googleDrive: { isConnected: false, autoBackup: false },
        browserNotificationsEnabled: false,
        dailyGoal: 3,
        aiEnabled: false,
        aiApiKey: '',
        paymentMethods: [],
        hasCompletedOnboarding: false,
        userProfile: { name: '사용자', currentStreak: 0 },
      },
    })
  })

  it('should have correct default values', () => {
    const { settings } = useSettingsStore.getState()
    expect(settings.theme).toBe('light')
    expect(settings.colorPalette).toBe('default')
    expect(settings.dailyGoal).toBe(3)
    expect(settings.aiEnabled).toBe(false)
  })

  it('should set theme', () => {
    useSettingsStore.getState().setTheme('dark')
    expect(useSettingsStore.getState().settings.theme).toBe('dark')
  })

  it('should set color palette', () => {
    useSettingsStore.getState().setColorPalette('ocean')
    expect(useSettingsStore.getState().settings.colorPalette).toBe('ocean')
  })

  it('should toggle music player', () => {
    expect(useSettingsStore.getState().settings.isMusicPlayerEnabled).toBe(false)
    useSettingsStore.getState().toggleMusicPlayer()
    expect(useSettingsStore.getState().settings.isMusicPlayerEnabled).toBe(true)
  })

  it('should clamp daily goal between 1 and 20', () => {
    useSettingsStore.getState().setDailyGoal(0)
    expect(useSettingsStore.getState().settings.dailyGoal).toBe(1)

    useSettingsStore.getState().setDailyGoal(25)
    expect(useSettingsStore.getState().settings.dailyGoal).toBe(20)

    useSettingsStore.getState().setDailyGoal(10)
    expect(useSettingsStore.getState().settings.dailyGoal).toBe(10)
  })

  it('should toggle task alert preferences', () => {
    expect(useSettingsStore.getState().settings.alertPreferences.task.dueReminder).toBe(true)
    useSettingsStore.getState().toggleTaskAlert('dueReminder')
    expect(useSettingsStore.getState().settings.alertPreferences.task.dueReminder).toBe(false)
  })

  it('should set AI enabled state', () => {
    useSettingsStore.getState().setAiEnabled(true)
    expect(useSettingsStore.getState().settings.aiEnabled).toBe(true)
  })

  it('should update user profile', () => {
    useSettingsStore.getState().updateProfile({ name: '테스트 사용자' })
    expect(useSettingsStore.getState().settings.userProfile.name).toBe('테스트 사용자')
  })
})
