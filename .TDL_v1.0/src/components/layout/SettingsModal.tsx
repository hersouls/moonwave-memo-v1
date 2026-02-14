import { clsx } from 'clsx'
import {
  Bell,
  BellRing,
  Bot,
  Check,
  Clock,
  Cloud,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Monitor,
  Moon,
  Smartphone,
  Sun,
  Target,
  Trash2,
  Upload,
  AlertTriangle,
  User,
  Settings,
  Shield,
  HardDrive,
  FolderOpen,
  Music,
} from 'lucide-react'
import { CategorySettings } from '@/components/settings/CategorySettings'
import { useEffect, useRef, useState } from 'react'
import type { TaskAlertPreferences } from '@/lib/types'

import { Button } from '@/components/ui/Button'
import { Tooltip } from '@/components/ui/Tooltip'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog, DialogHeader, DialogBody } from '@/components/ui/Dialog'
import {
  createBackup,
  downloadBackup,
  parseBackupFile,
  validateBackup,
  restoreFromBackup,
  clearAllData,
  type BackupValidationResult,
} from '@/services/backup'
import { validateApiKey } from '@/services/aiService'
import { useSettingsStore, type ThemeMode, applyTheme, applyColorPalette } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { COLOR_PALETTES, type ColorPalette } from '@/utils/constants'
import {
  getPermissionStatus,
  requestPermission,
} from '@/services/browserNotification'

import { useAuthStore, type SyncStatus } from '@/stores/authStore'

const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: '라이트', icon: <Sun className="w-4 h-4" /> },
  { value: 'dark', label: '다크', icon: <Moon className="w-4 h-4" /> },
  { value: 'system', label: '시스템', icon: <Monitor className="w-4 h-4" /> },
]

// Task Alert Configuration
const TASK_ALERTS: {
  key: keyof TaskAlertPreferences
  label: string
  description: string
  icon: React.ReactNode
}[] = [
    {
      key: 'dueReminder',
      label: '마감 리마인더',
      description: '마감일에 알림을 받습니다',
      icon: <Clock className="w-4 h-4" />,
    },
    {
      key: 'overdueAlert',
      label: '지연 알림',
      description: '지연된 작업이 있을 때 알림을 받습니다',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
  ]

// Toggle Item Component
function ToggleItem({
  icon,
  label,
  description,
  enabled,
  onChange,
}: {
  icon?: React.ReactNode
  label: string
  description: string
  enabled: boolean
  onChange: () => void
}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
            {icon}
          </div>
        )}
        <div>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {label}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {description}
          </div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onChange}
        className={clsx(
          'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
          enabled ? 'bg-primary-500' : 'bg-zinc-200 dark:bg-zinc-700'
        )}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
            enabled ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}

function SyncStatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'syncing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
          <Loader2 className="w-3 h-3 animate-spin" />
          동기화 중...
        </span>
      )
    case 'synced':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300">
          <Cloud className="w-3 h-3" />
          동기화됨
        </span>
      )
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
          <CloudOff className="w-3 h-3" />
          동기화 오류
        </span>
      )
    default:
      return null
  }
}

function CloudSyncSection() {
  const user = useAuthStore((s) => s.user)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const lastSyncTime = useAuthStore((s) => s.lastSyncTime)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const isSigningIn = useAuthStore((s) => s.isSigningIn)
  const authError = useAuthStore((s) => s.error)

  const formatSyncTime = (time: string | null) => {
    if (!time) return null
    try {
      return new Date(time).toLocaleString('ko-KR', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 px-1">
        클라우드 동기화
      </h3>

      <div className="p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm">
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-12 h-12 rounded-full ring-2 ring-white dark:ring-zinc-800 shadow-sm"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 text-lg font-bold ring-2 ring-white dark:ring-zinc-800 shadow-sm">
                    {user.displayName?.[0] || user.email?.[0] || '?'}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-base">
                    {user.displayName || user.email}
                  </div>
                  {user.displayName && (
                    <div className="text-sm text-zinc-500 dark:text-zinc-400">
                      {user.email}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={logout}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-danger-600 bg-zinc-50 hover:bg-danger-50 dark:bg-zinc-800 dark:hover:bg-danger-900/20 transition-colors border border-zinc-200 dark:border-zinc-700 hover:border-danger-200 dark:hover:border-danger-800"
              >
                로그아웃
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">상태:</span>
                <SyncStatusBadge status={syncStatus} />
              </div>
              {lastSyncTime && (
                <span className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatSyncTime(lastSyncTime)}
                </span>
              )}
            </div>

            <div className="flex items-start gap-2 text-xs text-zinc-500 dark:text-zinc-400 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg text-blue-700 dark:text-blue-300">
              <Cloud className="w-4 h-4 shrink-0 mt-0.5" />
              <span>다른 기기에서 같은 계정으로 로그인하면 자동으로 동기화됩니다.</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-2">
              <Cloud className="w-8 h-8 text-blue-500 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                기기 간 동기화
              </h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                Google 계정으로 로그인하여 모든 기기에서 작업을 동기화하세요.
              </p>
            </div>
            <button
              type="button"
              onClick={login}
              disabled={isSigningIn}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[#4285F4] hover:bg-[#3367D6] text-white font-medium shadow-md hover:shadow-lg transition-all active:scale-95 disabled:opacity-50 disabled:scale-100 min-w-[200px]"
            >
              {isSigningIn ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              )}
              {isSigningIn ? '로그인 중...' : 'Google로 로그인'}
            </button>
            {authError && (
              <div className="flex items-start gap-2 text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/10 p-3 rounded-lg mx-auto max-w-xs text-left">
                <CloudOff className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{authError}</span>
              </div>
            )}
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              로그인 없이도 로컬에서 모든 기능을 사용할 수 있습니다.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

type SettingsTab = 'general' | 'account' | 'data' | 'notifications' | 'system' | 'categories'

export function SettingsModal() {
  const isOpen = useUIStore((state) => state.isSettingsModalOpen)
  const closeModal = useUIStore((state) => state.closeSettingsModal)

  const settings = useSettingsStore((state) => state.settings)
  const setTheme = useSettingsStore((state) => state.setTheme)
  const toggleMusicPlayer = useSettingsStore((state) => state.toggleMusicPlayer)
  const setColorPalette = useSettingsStore((state) => state.setColorPalette)
  const setLastBackupDate = useSettingsStore((state) => state.setLastBackupDate)
  const toggleTaskAlert = useSettingsStore((state) => state.toggleTaskAlert)
  const setBrowserNotifications = useSettingsStore((state) => state.setBrowserNotifications)
  const setAiEnabled = useSettingsStore((state) => state.setAiEnabled)
  const setAiApiKey = useSettingsStore((state) => state.setAiApiKey)
  const setDailyGoal = useSettingsStore((state) => state.setDailyGoal)
  const user = useAuthStore((s) => s.user)
  const openFAQModal = useUIStore((state) => state.openFAQModal)
  const openTermsModal = useUIStore((state) => state.openTermsModal)

  const handleClose = () => {
    // Rollback preview to saved settings
    applyTheme(settings.theme)
    applyColorPalette(settings.colorPalette)
    closeModal()
  }
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [localTheme, setLocalTheme] = useState<ThemeMode>(settings.theme)
  const [localPalette, setLocalPalette] = useState<ColorPalette>(settings.colorPalette)
  const [localDailyGoal, setLocalDailyGoal] = useState(settings.dailyGoal)

  // Deferred toggle states (applied on Save, reverted on Cancel)
  const [localMusicPlayer, setLocalMusicPlayer] = useState(settings.isMusicPlayerEnabled)
  const [localBrowserNotif, setLocalBrowserNotif] = useState(settings.browserNotificationsEnabled)
  const [localDueReminder, setLocalDueReminder] = useState(settings.alertPreferences?.task?.dueReminder ?? true)
  const [localOverdueAlert, setLocalOverdueAlert] = useState(settings.alertPreferences?.task?.overdueAlert ?? true)
  const [localAiEnabled, setLocalAiEnabled] = useState(settings.aiEnabled)

  // PWA Install state
  const [canInstallPWA, setCanInstallPWA] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  // Backup/Restore states
  const [isBackingUp, setIsBackingUp] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [pendingRestore, setPendingRestore] = useState<{
    file: File
    validation: BackupValidationResult
  } | null>(null)

  // Browser notification permission state
  const [notificationPermission, setNotificationPermission] = useState<string>('default')

  // AI settings state
  const [aiKeyInput, setAiKeyInput] = useState('')
  const [originalAiKey, setOriginalAiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isValidatingKey, setIsValidatingKey] = useState(false)
  const [keyValidationResult, setKeyValidationResult] = useState<'success' | 'error' | null>(null)

  // Tab refs for keyboard navigation
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Detect unsaved changes
  const hasChanges =
    localTheme !== settings.theme ||
    localPalette !== settings.colorPalette ||
    localMusicPlayer !== settings.isMusicPlayerEnabled ||
    localBrowserNotif !== settings.browserNotificationsEnabled ||
    localDueReminder !== (settings.alertPreferences?.task?.dueReminder ?? true) ||
    localOverdueAlert !== (settings.alertPreferences?.task?.overdueAlert ?? true) ||
    localAiEnabled !== settings.aiEnabled ||
    aiKeyInput !== originalAiKey ||
    localDailyGoal !== settings.dailyGoal

  // PWA Install detection
  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    setIsInstalled(isStandalone)

    // Listen for install availability
    const handleInstallAvailable = () => setCanInstallPWA(true)
    window.addEventListener('pwaInstallAvailable', handleInstallAvailable)

    // Check if already available
    if ((window as Window & { installPWA?: () => Promise<boolean> }).installPWA) {
      setCanInstallPWA(true)
    }

    return () => {
      window.removeEventListener('pwaInstallAvailable', handleInstallAvailable)
    }
  }, [])

  // PWA Install handler
  const handleInstallPWA = async () => {
    const installFn = (window as Window & { installPWA?: () => Promise<boolean> }).installPWA
    if (installFn) {
      const accepted = await installFn()
      if (accepted) {
        setCanInstallPWA(false)
        setIsInstalled(true)
      }
    }
  }

  // Check notification permission on mount
  useEffect(() => {
    setNotificationPermission(getPermissionStatus())
  }, [])

  // Browser notification toggle handler (deferred - only toggles local state)
  const handleBrowserNotificationToggle = async () => {
    if (!localBrowserNotif) {
      // Trying to enable - request permission first
      const granted = await requestPermission()
      if (granted) {
        setLocalBrowserNotif(true)
        setNotificationPermission('granted')
      }
    } else {
      setLocalBrowserNotif(false)
    }
  }

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalTheme(settings.theme)
      setLocalPalette(settings.colorPalette)
      setRestoreError(null)
      setKeyValidationResult(null)
      setLocalMusicPlayer(settings.isMusicPlayerEnabled)
      setLocalBrowserNotif(settings.browserNotificationsEnabled)
      setLocalDueReminder(settings.alertPreferences?.task?.dueReminder ?? true)
      setLocalOverdueAlert(settings.alertPreferences?.task?.overdueAlert ?? true)
      setLocalAiEnabled(settings.aiEnabled)
      setLocalDailyGoal(settings.dailyGoal)
      // Decrypt API key for display
      useSettingsStore.getState().getDecryptedApiKey().then((key) => {
        setAiKeyInput(key)
        setOriginalAiKey(key)
      })
    }
  }, [isOpen, settings.theme, settings.colorPalette, settings.isMusicPlayerEnabled,
    settings.browserNotificationsEnabled, settings.alertPreferences?.task?.dueReminder,
    settings.alertPreferences?.task?.overdueAlert, settings.aiEnabled, settings.dailyGoal])

  // Real-time theme preview
  useEffect(() => {
    if (isOpen) applyTheme(localTheme)
  }, [localTheme, isOpen])

  // Real-time palette preview
  useEffect(() => {
    if (isOpen) applyColorPalette(localPalette)
  }, [localPalette, isOpen])

  const handleSave = () => {
    setTheme(localTheme)
    setColorPalette(localPalette)
    // Save AI API key (will be encrypted by store)
    if (aiKeyInput !== originalAiKey) {
      setAiApiKey(aiKeyInput)
    }
    // Save deferred toggles
    if (localMusicPlayer !== settings.isMusicPlayerEnabled) toggleMusicPlayer()
    if (localBrowserNotif !== settings.browserNotificationsEnabled) setBrowserNotifications(localBrowserNotif)
    if (localDueReminder !== (settings.alertPreferences?.task?.dueReminder ?? true)) toggleTaskAlert('dueReminder')
    if (localOverdueAlert !== (settings.alertPreferences?.task?.overdueAlert ?? true)) toggleTaskAlert('overdueAlert')
    if (localAiEnabled !== settings.aiEnabled) setAiEnabled(localAiEnabled)
    if (localDailyGoal !== settings.dailyGoal) setDailyGoal(localDailyGoal)
    closeModal()
  }

  const handleValidateApiKey = async () => {
    if (!aiKeyInput.trim()) return
    setIsValidatingKey(true)
    setKeyValidationResult(null)
    try {
      const valid = await validateApiKey(aiKeyInput.trim())
      setKeyValidationResult(valid ? 'success' : 'error')
    } catch {
      setKeyValidationResult('error')
    } finally {
      setIsValidatingKey(false)
    }
  }

  // Backup handler
  const handleBackup = async () => {
    setIsBackingUp(true)
    try {
      const backup = await createBackup()
      downloadBackup(backup)
      setLastBackupDate(new Date())
    } catch (error) {
      console.error('Backup failed:', error)
    } finally {
      setIsBackingUp(false)
    }
  }

  // File selection handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    e.target.value = ''
    setRestoreError(null)

    const result = await parseBackupFile(file)
    if (!result.success || !result.data) {
      setRestoreError(result.error || '파일을 읽을 수 없습니다.')
      return
    }

    const validation = validateBackup(result.data)
    if (!validation.valid) {
      setRestoreError(validation.errors.join('\n'))
      return
    }

    setPendingRestore({ file, validation })
    setShowRestoreConfirm(true)
  }

  // Restore confirmation handler
  const handleRestoreConfirm = async () => {
    if (!pendingRestore) return

    setShowRestoreConfirm(false)
    setIsRestoring(true)

    try {
      const parseResult = await parseBackupFile(pendingRestore.file)
      if (!parseResult.success || !parseResult.data) {
        throw new Error('파일을 읽을 수 없습니다.')
      }

      const result = await restoreFromBackup(parseResult.data)
      if (!result.success) {
        throw new Error(result.error)
      }

      closeModal()
      window.location.reload()
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : '복원에 실패했습니다.')
    } finally {
      setIsRestoring(false)
      setPendingRestore(null)
    }
  }

  // Clear all data handler
  const handleClearAllData = async () => {
    setShowClearConfirm(false)
    try {
      await clearAllData()
      window.location.reload()
    } catch (error) {
      console.error('Clear data failed:', error)
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '없음'
    try {
      return new Date(dateStr).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '없음'
    }
  }

  // Tab Content Components
  const renderGeneralSettings = () => (
    <div className="space-y-8">
      {/* Theme Selection */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          화면 테마
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setLocalTheme(option.value)}
              className={clsx(
                'flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200',
                localTheme === option.value
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900'
              )}
            >
              <div className={clsx(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                localTheme === option.value ? "bg-white dark:bg-zinc-800 shadow-sm" : "bg-zinc-100 dark:bg-zinc-800"
              )}>
                {option.icon}
              </div>
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Color Palette Selection */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            강조 색상
          </h3>
          {localTheme === 'dark' && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              다크 모드에서는 색상이 자동 조정됩니다
            </span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {Object.values(COLOR_PALETTES).map((palette) => (
            <button
              key={palette.id}
              type="button"
              onClick={() => setLocalPalette(palette.id)}
              className={clsx(
                'group relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all duration-200 hover:scale-105',
                localPalette === palette.id
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
              )}
            >
              <div className="relative flex gap-1">
                <div
                  className="w-6 h-6 rounded-full shadow-sm ring-1 ring-black/5"
                  style={{ backgroundColor: palette.colors.primary }}
                />
                <div
                  className="w-6 h-6 rounded-full shadow-sm ring-1 ring-black/5 -ml-2"
                  style={{ backgroundColor: palette.colors.secondary }}
                />
                {localPalette === palette.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-5 h-5 rounded-full bg-white/80 dark:bg-zinc-900/80 flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                    </div>
                  </div>
                )}
              </div>
              <span className={clsx(
                "text-xs font-medium transition-colors",
                localPalette === palette.id ? "text-primary-700 dark:text-primary-300" : "text-zinc-600 dark:text-zinc-400"
              )}>
                {palette.nameKo}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Daily Goal */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          일일 목표
        </h3>
        <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                하루 목표 작업 수
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                프로필 페이지에 표시됩니다
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocalDailyGoal(Math.max(1, localDailyGoal - 1))}
              className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              -
            </button>
            <span className="w-8 text-center text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {localDailyGoal}
            </span>
            <button
              type="button"
              onClick={() => setLocalDailyGoal(Math.min(20, localDailyGoal + 1))}
              className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Music Player */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          추가 기능
        </h3>
        <ToggleItem
          icon={<Music className="w-4 h-4" />}
          label="배경음악 플레이어"
          description="푸터에 lofi 음악 플레이어를 표시합니다."
          enabled={localMusicPlayer}
          onChange={() => setLocalMusicPlayer(!localMusicPlayer)}
        />
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* App Info */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          앱 정보
        </h3>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">버전</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">1.0.0</span>
          </div>
          <div className="border-t border-zinc-100 dark:border-zinc-800" />
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { handleClose(); setTimeout(openFAQModal, 150) }}
              className="flex-1 text-center py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              FAQ
            </button>
            <button
              type="button"
              onClick={() => { handleClose(); setTimeout(openTermsModal, 150) }}
              className="flex-1 text-center py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              이용약관
            </button>
          </div>
        </div>
      </section>
    </div>
  )

  const renderAccountSettings = () => (
    <div className="space-y-8">
      {/* Profile */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          프로필 설정
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-sm">
          {user ? (
            <>
              <div className="relative">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-24 h-24 rounded-full ring-4 ring-white dark:ring-zinc-900 shadow-lg object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 text-3xl font-bold ring-4 ring-white dark:ring-zinc-900 shadow-lg">
                    {user.displayName?.[0] || user.email?.[0] || '?'}
                  </div>
                )}
              </div>
              <div className="flex-1 w-full space-y-3 text-center sm:text-left">
                <div>
                  <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                    {user.displayName || '사용자'}
                  </p>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    {user.email}
                  </p>
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                  <Check className="w-3 h-3" />
                  Google 계정 연동됨
                </div>
              </div>
            </>
          ) : (
            <div className="w-full text-center py-4">
              <User className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Google 로그인 시 프로필이 자동으로 표시됩니다.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )

  const renderDataSettings = () => (
    <div className="space-y-8">
      {/* Cloud Sync */}
      <CloudSyncSection />

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Backup & Restore */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          백업 및 복원
        </h3>
        <div className="space-y-3">
          {/* Backup */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/80">
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                백업 다운로드
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                마지막 백업: <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatDate(settings.lastBackupDate)}</span>
              </div>
            </div>
            <Tooltip content="데이터를 JSON 파일로 다운로드" placement="left">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleBackup}
                disabled={isBackingUp}
              >
                <Download className="w-4 h-4 mr-1.5" />
                {isBackingUp ? '백업 중...' : '백업'}
              </Button>
            </Tooltip>
          </div>

          {/* Restore */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-900/80">
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                데이터 복원
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                백업 파일에서 데이터를 복원합니다.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip content="JSON 파일에서 데이터 복원" placement="left">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isRestoring}
                >
                  <Upload className="w-4 h-4 mr-1.5" />
                  {isRestoring ? '복원 중...' : '복원'}
                </Button>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Restore Error */}
          {restoreError && (
            <div className="p-4 rounded-xl bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-danger-700 dark:text-danger-300 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">복원 오류</span>
              </div>
              <p className="text-xs text-danger-600 dark:text-danger-400 whitespace-pre-line pl-6">
                {restoreError}
              </p>
            </div>
          )}

        </div>
      </section>
    </div>
  )

  const renderNotificationSettings = () => (
    <div className="space-y-8">
      {/* Browser Notification Toggle */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          브라우저 알림
        </h3>
        <div className="p-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center text-primary-500 shadow-sm border border-zinc-100 dark:border-zinc-700">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  푸시 알림 활성화
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  앱 실행 시 새 알림을 브라우저 푸시로 받습니다
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localBrowserNotif}
              onClick={handleBrowserNotificationToggle}
              disabled={notificationPermission === 'denied' || notificationPermission === 'unsupported'}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                localBrowserNotif
                  ? 'bg-primary-500'
                  : 'bg-zinc-200 dark:bg-zinc-700',
                (notificationPermission === 'denied' || notificationPermission === 'unsupported') &&
                'opacity-50 cursor-not-allowed'
              )}
            >
              <span
                aria-hidden="true"
                className={clsx(
                  'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                  localBrowserNotif ? 'translate-x-5' : 'translate-x-0'
                )}
              />
            </button>
          </div>
          {notificationPermission === 'denied' && (
            <div className="flex items-start gap-2 p-3 bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 rounded-lg text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>브라우저 설정에서 알림이 차단되어 있습니다. 주소창의 자물쇠 아이콘을 클릭하여 권한을 허용해주세요.</span>
            </div>
          )}
          {notificationPermission === 'unsupported' && (
            <div className="flex items-start gap-2 p-3 bg-warning-50 dark:bg-warning-900/20 text-warning-600 dark:text-warning-400 rounded-lg text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>이 브라우저에서는 알림을 지원하지 않습니다.</span>
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Task Alerts */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          작업 알림
        </h3>
        <div className="space-y-3">
          {TASK_ALERTS.map((alert) => (
            <ToggleItem
              key={alert.key}
              icon={alert.icon}
              label={alert.label}
              description={alert.description}
              enabled={alert.key === 'dueReminder' ? localDueReminder : localOverdueAlert}
              onChange={() => {
                if (alert.key === 'dueReminder') setLocalDueReminder(!localDueReminder)
                else setLocalOverdueAlert(!localOverdueAlert)
              }}
            />
          ))}
        </div>
      </section>
    </div>
  )

  const renderSystemSettings = () => (
    <div className="space-y-8">
      {/* PWA Install */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          앱 설치
        </h3>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          {isInstalled ? (
            <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium">앱이 이미 설치되어 있습니다</span>
            </div>
          ) : canInstallPWA ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 space-y-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  앱으로 설치하기
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  홈 화면에 추가하여 네이티브 앱처럼 더 빠르고 편리하게 사용할 수 있습니다.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleInstallPWA}
              >
                <Download className="w-4 h-4 mr-1.5" />
                설치하기
              </Button>
            </div>
          ) : (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              <p className="mb-2">
                브라우저 메뉴에서 "홈 화면에 추가"를 선택하여 앱을 설치할 수 있습니다.
              </p>
              <ul className="list-disc list-inside text-xs space-y-1 pl-1">
                <li>Chrome: 메뉴 → 앱 설치</li>
                <li>Safari: 공유 → 홈 화면에 추가</li>
                <li>Samsung: 메뉴 → 페이지를 다음으로 추가 → 홈 화면</li>
              </ul>
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* AI Settings */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          AI 기능
        </h3>

        {/* AI Toggle */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
            <ToggleItem
              icon={<Bot className="w-4 h-4" />}
              label="AI 기능 활성화"
              description="자연어 파싱, 작업 분해, 생산성 요약 등 AI 기능을 사용합니다."
              enabled={localAiEnabled}
              onChange={() => setLocalAiEnabled(!localAiEnabled)}
            />
          </div>

          {/* API Key Input (shown when AI is enabled) */}
          {localAiEnabled && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/30 space-y-3 animate-in fade-in slide-in-from-top-2">
              <div>
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                  Anthropic API 키
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={aiKeyInput}
                      onChange={(e) => {
                        setAiKeyInput(e.target.value)
                        setKeyValidationResult(null)
                      }}
                      placeholder="sk-ant-api03-..."
                      className="w-full px-3 py-2 pr-9 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleValidateApiKey}
                    disabled={isValidatingKey || !aiKeyInput.trim()}
                  >
                    {isValidatingKey ? '확인 중...' : '연결 확인'}
                  </Button>
                </div>
                {keyValidationResult === 'success' && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    API 키가 유효합니다.
                  </div>
                )}
                {keyValidationResult === 'error' && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-danger-600 dark:text-danger-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-danger-500" />
                    API 키가 유효하지 않습니다. 확인 후 다시 시도해주세요.
                  </div>
                )}
              </div>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-2 rounded-lg">
                <Shield className="w-3 h-3" />
                API 키는 브라우저 로컬 스토리지에만 저장되며 외부 서버로 전송되지 않습니다.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Danger Zone */}
      <section>
        <h3 className="text-sm font-semibold text-danger-600 dark:text-danger-400 mb-4 px-1">
          위험 영역
        </h3>
        <div className="flex items-center justify-between p-4 rounded-xl border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/10">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-danger-700 dark:text-danger-300">
              모든 데이터 삭제
            </div>
            <div className="text-xs text-danger-600/80 dark:text-danger-400/80">
              모든 작업과 설정이 삭제됩니다. 복구할 수 없습니다.
            </div>
          </div>
          <Tooltip content="모든 데이터 영구 삭제 (되돌릴 수 없음)" placement="left">
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              삭제
            </Button>
          </Tooltip>
        </div>
      </section>
    </div>
  )

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: '일반', icon: <Settings className="w-4 h-4" /> },
    { id: 'account', label: '계정', icon: <User className="w-4 h-4" /> },
    { id: 'data', label: '데이터', icon: <HardDrive className="w-4 h-4" /> },
    { id: 'categories', label: '카테고리', icon: <FolderOpen className="w-4 h-4" /> },
    { id: 'notifications', label: '알림', icon: <Bell className="w-4 h-4" /> },
    { id: 'system', label: '시스템', icon: <Shield className="w-4 h-4" /> },
  ]

  // Keyboard navigation for tabs
  const handleTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    const total = tabs.length
    let nextIndex = -1

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      nextIndex = (index + 1) % total
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      nextIndex = (index - 1 + total) % total
    }

    if (nextIndex >= 0) {
      setActiveTab(tabs[nextIndex].id)
      tabRefs.current[nextIndex]?.focus()
    }
  }

  return (
    <>
      <Dialog open={isOpen} onClose={handleClose} size="4xl" noPadding>
        <div className="flex flex-col h-[90dvh] sm:h-auto sm:max-h-[800px]">
          <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
            <DialogHeader title="설정" onClose={handleClose} />
          </div>
          <DialogBody className="p-0 overflow-hidden flex-1 min-h-0 flex flex-col md:flex-row">
            {/* Sidebar Tabs */}
            <div className="relative md:contents">
              <aside
                role="tablist"
                aria-label="설정 탭"
                className="w-full md:w-64 bg-zinc-50/80 dark:bg-zinc-900/50 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-2 md:p-4 gap-1 md:gap-1.5 overflow-x-auto md:overflow-y-auto flex-shrink-0 flex md:flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                {tabs.map((tab, index) => (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[index] = el }}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    tabIndex={activeTab === tab.id ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className={clsx(
                      'flex-shrink-0 min-w-[68px] md:min-w-0 w-auto md:w-full flex flex-col md:flex-row items-center gap-1 md:gap-3 px-2.5 md:px-3.5 py-2 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition-all duration-200 relative',
                      activeTab === tab.id
                        ? 'bg-white dark:bg-zinc-800 text-primary-600 dark:text-primary-400 shadow-sm ring-1 ring-zinc-200 dark:ring-zinc-700 md:translate-x-0.5'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-200'
                    )}
                  >
                    <span className={clsx("transition-colors", activeTab === tab.id ? "text-primary-500" : "text-zinc-400 dark:text-zinc-500")}>
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
                    {/* Mobile active indicator */}
                    {activeTab === tab.id && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary-500 md:hidden" />
                    )}
                  </button>
                ))}
              </aside>
              {/* Scroll hint gradient - mobile only */}
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-zinc-50 dark:from-zinc-900 pointer-events-none md:hidden" aria-hidden="true" />
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0 overflow-y-auto bg-white dark:bg-zinc-950">
              <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-8">
                {activeTab === 'general' && renderGeneralSettings()}
                {activeTab === 'account' && renderAccountSettings()}
                {activeTab === 'data' && renderDataSettings()}
                {activeTab === 'categories' && <CategorySettings />}
                {activeTab === 'notifications' && renderNotificationSettings()}
                {activeTab === 'system' && renderSystemSettings()}
              </div>
            </div>
          </DialogBody>
          <div className="flex-shrink-0 flex items-center justify-end gap-2 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 sm:px-6 sm:py-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.2)]">
            <Button variant="ghost" onClick={handleClose}>
              취소
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={!hasChanges}>
              저장
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      < ConfirmDialog
        open={showRestoreConfirm}
        onClose={() => {
          setShowRestoreConfirm(false)
          setPendingRestore(null)
        }
        }
        onConfirm={handleRestoreConfirm}
        title="데이터 복원"
        description={`백업 파일에서 데이터를 복원합니다.\n\n버전: ${pendingRestore?.validation.metadata?.version || 'unknown'}\n백업 날짜: ${formatDate(pendingRestore?.validation.metadata?.exportDate)}\n작업 수: ${pendingRestore?.validation.metadata?.taskCount || 0}개\n\n현재 데이터는 덮어쓰기됩니다. 계속하시겠습니까?`}
        confirmText="복원"
        variant="warning"
        isLoading={isRestoring}
      />

      {/* Clear Data Confirmation Dialog */}
      < ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllData}
        title="모든 데이터 삭제"
        description={'정말로 모든 데이터를 삭제하시겠습니까?\n\n모든 작업과 설정이 영구적으로 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.'}
        confirmText="모두 삭제"
        variant="danger"
      />
    </>
  )
}
