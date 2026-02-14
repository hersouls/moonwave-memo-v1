import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import {
  Check,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  Download,
  Eye,
  EyeOff,
  FolderOpen,
  HardDrive,
  Loader2,
  Mic,
  Monitor,
  Moon,
  Pencil,
  Plus,
  Settings,
  Shield,
  Smartphone,
  Sun,
  StickyNote,
  Trash2,
  Upload,
  User,
  AlertTriangle,
} from 'lucide-react'
import { useSettingsStore, applyTheme, applyColorPalette } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { useFolderStore } from '@/stores/folderStore'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogHeader, DialogBody } from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { COLOR_PALETTES, MEMO_COLORS } from '@/utils/constants'
import {
  createBackup,
  downloadBackup,
  parseBackupFile,
  validateBackup,
  restoreFromBackup,
  clearAllData,
  type BackupValidationResult,
} from '@/services/backup'
import { useToastStore } from '@/stores/toastStore'
import type { ThemeMode, ColorPalette, MemoColor, InputStartPosition, STTLanguage } from '@/lib/types'
import type { SyncStatus } from '@/lib/types'

// ─── Theme Options ──────────────────────────────────
const themeOptions: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: '라이트', icon: <Sun className="w-4 h-4" /> },
  { value: 'dark', label: '다크', icon: <Moon className="w-4 h-4" /> },
  { value: 'system', label: '시스템', icon: <Monitor className="w-4 h-4" /> },
]

// ─── Sync Status Badge ──────────────────────────────
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
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
          <Cloud className="w-3 h-3" />
          동기화됨
        </span>
      )
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
          <CloudOff className="w-3 h-3" />
          동기화 오류
        </span>
      )
    default:
      return null
  }
}

// ─── Cloud Sync Section ─────────────────────────────
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
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-500 hover:text-red-600 bg-zinc-50 hover:bg-red-50 dark:bg-zinc-800 dark:hover:bg-red-900/20 transition-colors border border-zinc-200 dark:border-zinc-700 hover:border-red-200 dark:hover:border-red-800"
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

            <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg">
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
                Google 계정으로 로그인하여 모든 기기에서 메모를 동기화하세요.
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
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10 p-3 rounded-lg mx-auto max-w-xs text-left">
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

// ─── Toggle Item ────────────────────────────────────
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

// ─── Settings Tabs ──────────────────────────────────
type SettingsTab = 'general' | 'account' | 'data' | 'memo' | 'ai' | 'system'

export function SettingsModal() {
  const isOpen = useUIStore((state) => state.isSettingsModalOpen)
  const closeModal = useUIStore((state) => state.closeSettingsModal)

  const settings = useSettingsStore((s) => s.settings)
  const setTheme = useSettingsStore((s) => s.setTheme)
  const setColorPalette = useSettingsStore((s) => s.setColorPalette)
  const setDefaultColor = useSettingsStore((s) => s.setDefaultColor)
  const setDefaultFolder = useSettingsStore((s) => s.setDefaultFolder)
  const setInputStartPosition = useSettingsStore((s) => s.setInputStartPosition)
  const toggleHashtagToTag = useSettingsStore((s) => s.toggleHashtagToTag)
  const toggleLinkPreview = useSettingsStore((s) => s.toggleLinkPreview)
  const setLastBackupDate = useSettingsStore((s) => s.setLastBackupDate)
  const setOpenAIApiKey = useSettingsStore((s) => s.setOpenAIApiKey)
  const setAnthropicApiKey = useSettingsStore((s) => s.setAnthropicApiKey)
  const setSTTLanguage = useSettingsStore((s) => s.setSTTLanguage)
  const showToast = useToastStore((s) => s.showToast)
  const openTermsModal = useUIStore((state) => state.openTermsModal)
  const user = useAuthStore((s) => s.user)
  const folders = useFolderStore((s) => s.folders).filter((f) => !f.isSystem)
  const addFolder = useFolderStore((s) => s.addFolder)
  const updateFolder = useFolderStore((s) => s.updateFolder)
  const deleteFolder = useFolderStore((s) => s.deleteFolder)

  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [localTheme, setLocalTheme] = useState<ThemeMode>(settings.theme)
  const [localPalette, setLocalPalette] = useState<ColorPalette>(settings.colorPalette)

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

  // Folder management state
  const [isAddingFolder, setIsAddingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderColor, setNewFolderColor] = useState('#3B82F6')
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null)
  const [editFolderName, setEditFolderName] = useState('')
  const [editFolderColor, setEditFolderColor] = useState('')

  const FOLDER_COLORS = ['#F59E0B', '#84CC16', '#22C55E', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444']

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Detect unsaved changes
  const hasChanges = localTheme !== settings.theme || localPalette !== settings.colorPalette

  // PWA Install detection
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    setIsInstalled(isStandalone)

    // Listen for future beforeinstallprompt events
    const handleInstallAvailable = () => setCanInstallPWA(true)
    window.addEventListener('pwaInstallAvailable', handleInstallAvailable)

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setCanInstallPWA(false)
    }
    window.addEventListener('appinstalled', handleAppInstalled)

    // Check if install prompt was already captured before this component mounted
    if ((window as Window & { installPWA?: () => Promise<boolean> }).installPWA) {
      setCanInstallPWA(true)
    }

    return () => {
      window.removeEventListener('pwaInstallAvailable', handleInstallAvailable)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  // Real-time theme preview
  useEffect(() => {
    if (isOpen) {
      applyTheme(localTheme)
    }
  }, [localTheme, isOpen])

  // Real-time palette preview
  useEffect(() => {
    if (isOpen) {
      applyColorPalette(localPalette)
    }
  }, [localPalette, isOpen])

  // Sync local state when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalTheme(settings.theme)
      setLocalPalette(settings.colorPalette)
    }
  }, [isOpen, settings.theme, settings.colorPalette])

  const handleSave = () => {
    setTheme(localTheme)
    setColorPalette(localPalette)
    closeModal()
  }

  const handleClose = () => {
    // Rollback preview changes
    applyTheme(settings.theme)
    applyColorPalette(settings.colorPalette)
    closeModal()
  }

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

  const defaultFolder = folders.find((f) => f.id === settings.memoSettings.defaultFolderId) || folders.find((f) => f.isDefault)
  const positionLabel: Record<InputStartPosition, string> = { title: '제목', body: '본문' }

  // ─── Tab Content: General ─────────────────────────
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
                'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                localTheme === option.value ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'bg-zinc-100 dark:bg-zinc-800'
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
                'text-xs font-medium transition-colors',
                localPalette === palette.id ? 'text-primary-700 dark:text-primary-300' : 'text-zinc-600 dark:text-zinc-400'
              )}>
                {palette.nameKo}
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Font Settings (non-functional placeholder) */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          글자 설정
        </h3>
        <div className="w-full flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">글자 크기·글꼴</span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">추후 업데이트 예정</span>
        </div>
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
          <div className="border-t border-zinc-100 dark:border-zinc-800 my-3" />
          <button
            onClick={() => { closeModal(); setTimeout(() => openTermsModal(), 200) }}
            className="text-sm text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors"
          >
            서비스 약관 · 개인정보처리방침
          </button>
        </div>
      </section>
    </div>
  )

  // ─── Tab Content: Account ─────────────────────────
  const renderAccountSettings = () => (
    <div className="space-y-8">
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

  // ─── Tab Content: Data ────────────────────────────
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBackup}
              disabled={isBackingUp}
            >
              <Download className="w-4 h-4 mr-1.5" />
              {isBackingUp ? '백업 중...' : '백업'}
            </Button>
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
              >
                <Upload className="w-4 h-4 mr-1.5" />
                {isRestoring ? '복원 중...' : '복원'}
              </Button>
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
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-300 mb-1">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-semibold">복원 오류</span>
              </div>
              <p className="text-xs text-red-600 dark:text-red-400 whitespace-pre-line pl-6">
                {restoreError}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  )

  // ─── Tab Content: Memo ────────────────────────────
  const renderMemoSettings = () => (
    <div className="space-y-8">
      {/* Default Color */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          기본 메모 색상
        </h3>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            {(Object.keys(MEMO_COLORS) as MemoColor[]).map((c) => (
              <button
                key={c}
                onClick={() => setDefaultColor(c)}
                className={clsx(
                  'w-8 h-8 rounded-full border-2 transition-all',
                  settings.memoSettings.defaultColor === c
                    ? 'border-primary-500 scale-110'
                    : 'border-zinc-200 dark:border-zinc-600'
                )}
                style={{ backgroundColor: MEMO_COLORS[c] }}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Default Folder */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          기본 폴더
        </h3>
        <button
          onClick={() => {
            const currentIdx = folders.findIndex((f) => f.id === settings.memoSettings.defaultFolderId)
            const nextFolder = folders[(currentIdx + 1) % folders.length]
            setDefaultFolder(nextFolder?.id ?? null)
          }}
          className="w-full flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-colors"
        >
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">새 메모 기본 폴더</span>
          <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{defaultFolder?.name || '내 메모'}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Input Start Position */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          입력 시작 위치
        </h3>
        <button
          onClick={() => {
            setInputStartPosition(
              settings.memoSettings.inputStartPosition === 'title' ? 'body' : 'title'
            )
          }}
          className="w-full flex items-center justify-between p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900/80 transition-colors"
        >
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">새 메모 커서 위치</span>
          <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{positionLabel[settings.memoSettings.inputStartPosition]}</span>
            <ChevronRight className="w-4 h-4" />
          </div>
        </button>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Toggle Settings */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          추가 기능
        </h3>
        <div className="space-y-3">
          <ToggleItem
            label="'#텍스트' 입력 시 태그로 변환"
            description="태그로 변환 후에는 해당 태그를 포함하는 메모를 모아볼 수 있습니다."
            enabled={settings.memoSettings.hashtagToTag}
            onChange={toggleHashtagToTag}
          />
          <ToggleItem
            label="링크 미리보기 표시"
            description="URL 입력 시 링크 미리보기를 함께 표시합니다."
            enabled={settings.memoSettings.linkPreview}
            onChange={toggleLinkPreview}
          />
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Folder Management */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            폴더 관리
          </h3>
          {!isAddingFolder && (
            <button
              onClick={() => { setIsAddingFolder(true); setNewFolderName(''); setNewFolderColor('#3B82F6') }}
              className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              새 폴더
            </button>
          )}
        </div>

        <div className="space-y-2">
          {/* Add folder form */}
          {isAddingFolder && (
            <div className="p-3 rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10 space-y-3">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="폴더 이름"
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    addFolder(newFolderName.trim(), newFolderColor)
                    setIsAddingFolder(false)
                    setNewFolderName('')
                  }
                  if (e.key === 'Escape') setIsAddingFolder(false)
                }}
              />
              <div className="flex items-center gap-1.5">
                {FOLDER_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewFolderColor(c)}
                    className={clsx(
                      'w-6 h-6 rounded-full transition-all',
                      newFolderColor === c ? 'ring-2 ring-offset-1 ring-primary-500 scale-110' : ''
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setIsAddingFolder(false)}
                  className="px-3 py-1.5 text-xs font-medium text-zinc-500 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    if (newFolderName.trim()) {
                      addFolder(newFolderName.trim(), newFolderColor)
                      setIsAddingFolder(false)
                      setNewFolderName('')
                    }
                  }}
                  disabled={!newFolderName.trim()}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  만들기
                </button>
              </div>
            </div>
          )}

          {/* Folder list */}
          {folders.length === 0 && !isAddingFolder && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 text-center">
              <FolderOpen className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">폴더가 없습니다</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">새 폴더를 추가하여 메모를 정리하세요</p>
            </div>
          )}

          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50"
            >
              {editingFolderId === folder.id ? (
                <>
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={editFolderName}
                      onChange={(e) => setEditFolderName(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editFolderName.trim()) {
                          updateFolder(folder.id!, { name: editFolderName.trim(), color: editFolderColor })
                          setEditingFolderId(null)
                        }
                        if (e.key === 'Escape') setEditingFolderId(null)
                      }}
                    />
                    <div className="flex items-center gap-1.5">
                      {FOLDER_COLORS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setEditFolderColor(c)}
                          className={clsx(
                            'w-5 h-5 rounded-full transition-all',
                            editFolderColor === c ? 'ring-2 ring-offset-1 ring-primary-500 scale-110' : ''
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => {
                        if (editFolderName.trim()) {
                          updateFolder(folder.id!, { name: editFolderName.trim(), color: editFolderColor })
                          setEditingFolderId(null)
                        }
                      }}
                      className="px-2 py-1 text-xs font-medium text-white bg-primary-500 rounded hover:bg-primary-600"
                    >
                      저장
                    </button>
                    <button
                      onClick={() => setEditingFolderId(null)}
                      className="px-2 py-1 text-xs font-medium text-zinc-500 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      취소
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: folder.color }}
                  />
                  <span className="flex-1 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {folder.name}
                  </span>
                  {!folder.isDefault && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingFolderId(folder.id!)
                          setEditFolderName(folder.name)
                          setEditFolderColor(folder.color)
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        aria-label={`${folder.name} 편집`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          deleteFolder(folder.id!)
                          showToast(`'${folder.name}' 폴더가 삭제되었습니다`, 'info')
                        }}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        aria-label={`${folder.name} 삭제`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )

  // ─── Tab Content: AI ────────────────────────────────
  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [localOpenAIKey, setLocalOpenAIKey] = useState(settings.ai?.openaiApiKey || '')
  const [localAnthropicKey, setLocalAnthropicKey] = useState(settings.ai?.anthropicApiKey || '')
  const [openAIKeySaved, setOpenAIKeySaved] = useState(false)
  const [anthropicKeySaved, setAnthropicKeySaved] = useState(false)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)

  // Sync local keys when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalOpenAIKey(settings.ai?.openaiApiKey || '')
      setLocalAnthropicKey(settings.ai?.anthropicApiKey || '')
      setOpenAIKeySaved(false)
      setAnthropicKeySaved(false)
    }
  }, [isOpen, settings.ai?.openaiApiKey, settings.ai?.anthropicApiKey])

  // Debounce OpenAI key save
  useEffect(() => {
    if (!isOpen) return
    if (localOpenAIKey === (settings.ai?.openaiApiKey || '')) return
    setOpenAIKeySaved(false)
    const timer = setTimeout(() => {
      setOpenAIApiKey(localOpenAIKey)
      if (localOpenAIKey.trim()) setOpenAIKeySaved(true)
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localOpenAIKey])

  // Debounce Anthropic key save
  useEffect(() => {
    if (!isOpen) return
    if (localAnthropicKey === (settings.ai?.anthropicApiKey || '')) return
    setAnthropicKeySaved(false)
    const timer = setTimeout(() => {
      setAnthropicApiKey(localAnthropicKey)
      if (localAnthropicKey.trim()) setAnthropicKeySaved(true)
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localAnthropicKey])

  const handleTestConnection = async (provider: 'openai' | 'anthropic') => {
    const key = provider === 'openai' ? localOpenAIKey : localAnthropicKey
    if (!key.trim()) {
      showToast('API 키를 먼저 입력하세요', 'warning')
      return
    }
    setTestingProvider(provider)
    try {
      let res: Response
      if (provider === 'anthropic') {
        res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
        })
      } else {
        res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        })
      }
      if (res.ok) {
        showToast('연결 성공', 'success')
      } else {
        showToast('API 키를 확인해주세요', 'error')
      }
    } catch {
      showToast('네트워크 오류가 발생했습니다', 'error')
    } finally {
      setTestingProvider(null)
    }
  }

  const languageOptions: { value: STTLanguage; label: string }[] = [
    { value: 'ko', label: '한국어' },
    { value: 'en', label: 'English' },
    { value: 'ja', label: '日本語' },
    { value: 'zh', label: '中文' },
  ]

  const renderAISettings = () => (
    <div className="space-y-8">
      {/* OpenAI */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          OpenAI
        </h3>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              API 키
            </label>
            <div className="relative">
              <input
                type={showOpenAIKey ? 'text' : 'password'}
                value={localOpenAIKey}
                onChange={(e) => setLocalOpenAIKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="off"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                aria-label={showOpenAIKey ? 'API 키 숨기기' : 'API 키 보기'}
              >
                {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {openAIKeySaved && localOpenAIKey.trim() && (
              <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                저장됨
              </p>
            )}
          </div>
          <button
            onClick={() => handleTestConnection('openai')}
            disabled={testingProvider === 'openai' || !localOpenAIKey.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testingProvider === 'openai' ? (
              <><Loader2 className="w-4 h-4 animate-spin" />테스트 중...</>
            ) : '연결 테스트'}
          </button>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            음성 인식(STT), 텍스트 생성 등에 사용됩니다.
          </p>
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Anthropic */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          Anthropic
        </h3>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
              API 키
            </label>
            <div className="relative">
              <input
                type={showAnthropicKey ? 'text' : 'password'}
                value={localAnthropicKey}
                onChange={(e) => setLocalAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                autoComplete="off"
                className="w-full px-4 py-3 pr-12 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
              <button
                type="button"
                onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                aria-label={showAnthropicKey ? 'API 키 숨기기' : 'API 키 보기'}
              >
                {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {anthropicKeySaved && localAnthropicKey.trim() && (
              <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                저장됨
              </p>
            )}
          </div>
          <button
            onClick={() => handleTestConnection('anthropic')}
            disabled={testingProvider === 'anthropic' || !localAnthropicKey.trim()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testingProvider === 'anthropic' ? (
              <><Loader2 className="w-4 h-4 animate-spin" />테스트 중...</>
            ) : '연결 테스트'}
          </button>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            텍스트 분석, 요약, AI 어시스턴트 등에 사용됩니다.
          </p>
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* STT Language Selection */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          음성 인식 언어
        </h3>
        <div className="grid grid-cols-4 gap-2">
          {languageOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSTTLanguage(opt.value)}
              className={clsx(
                'px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                settings.ai?.language === opt.value
                  ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* AI Autocomplete toggle */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          AI 자동완성
        </h3>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">자동완성 활성화</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">입력 중 AI가 다음 문장을 제안합니다 (Tab으로 수락)</p>
            </div>
            <button
              onClick={() => useSettingsStore.getState().toggleAIAutocomplete()}
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors',
                settings.ai?.aiAutocomplete
                  ? 'bg-primary-500'
                  : 'bg-zinc-300 dark:bg-zinc-600'
              )}
            >
              <span className={clsx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                settings.ai?.aiAutocomplete ? 'translate-x-[22px]' : 'translate-x-0.5'
              )} />
            </button>
          </div>
        </div>
      </section>

      {/* Info */}
      <section>
        <div className="flex items-start gap-2 text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg">
          <Shield className="w-4 h-4 shrink-0 mt-0.5" />
          <span>API 키는 이 기기에만 저장되며 외부 서버로 전송되지 않습니다.</span>
        </div>
      </section>
    </div>
  )

  // ─── Tab Content: System ──────────────────────────
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
                <li>Chrome: 메뉴 &rarr; 앱 설치</li>
                <li>Safari: 공유 &rarr; 홈 화면에 추가</li>
                <li>Samsung: 메뉴 &rarr; 페이지를 다음으로 추가 &rarr; 홈 화면</li>
              </ul>
            </div>
          )}
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* High Contrast Mode */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          접근성
        </h3>
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">고대비 모드</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">텍스트와 UI 요소의 대비를 높여 가독성을 개선합니다</p>
            </div>
            <button
              onClick={() => useSettingsStore.getState().toggleHighContrast()}
              className={clsx(
                'relative w-11 h-6 rounded-full transition-colors',
                settings.highContrastMode
                  ? 'bg-primary-500'
                  : 'bg-zinc-300 dark:bg-zinc-600'
              )}
            >
              <span className={clsx(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                settings.highContrastMode ? 'translate-x-[22px]' : 'translate-x-0.5'
              )} />
            </button>
          </div>
        </div>
      </section>

      <div className="border-t border-zinc-100 dark:border-zinc-800" />

      {/* Danger Zone */}
      <section>
        <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-4 px-1">
          위험 영역
        </h3>
        <div className="flex items-center justify-between p-4 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-red-700 dark:text-red-300">
              모든 데이터 삭제
            </div>
            <div className="text-xs text-red-600/80 dark:text-red-400/80">
              모든 메모와 설정이 삭제됩니다. 복구할 수 없습니다.
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
          >
            <Trash2 className="w-4 h-4 mr-1.5" />
            삭제
          </Button>
        </div>
      </section>
    </div>
  )

  // ─── Tab Definitions ──────────────────────────────
  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'general', label: '일반', icon: <Settings className="w-4 h-4" /> },
    { id: 'account', label: '계정', icon: <User className="w-4 h-4" /> },
    { id: 'data', label: '데이터', icon: <HardDrive className="w-4 h-4" /> },
    { id: 'memo', label: '메모', icon: <StickyNote className="w-4 h-4" /> },
    { id: 'ai', label: 'AI 서비스', icon: <Mic className="w-4 h-4" /> },
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
          {/* Header */}
          <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
            <DialogHeader title="설정" onClose={handleClose} />
          </div>

          {/* Body: Sidebar Tabs + Content */}
          <DialogBody className="p-0 overflow-hidden flex-1 min-h-0 flex flex-col md:flex-row">
            {/* Sidebar Tabs */}
            <div className="relative md:contents">
              <aside
                role="tablist"
                aria-label="설정 탭"
                className="w-full md:w-56 bg-zinc-50/80 dark:bg-zinc-900/50 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-800 p-2 md:p-4 gap-1 md:gap-1.5 overflow-x-auto md:overflow-y-auto flex-shrink-0 flex md:flex-col [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
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
                    <span className={clsx('transition-colors', activeTab === tab.id ? 'text-primary-500' : 'text-zinc-400 dark:text-zinc-500')}>
                      {tab.icon}
                    </span>
                    <span className="truncate">{tab.label}</span>
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
                {activeTab === 'memo' && renderMemoSettings()}
                {activeTab === 'ai' && renderAISettings()}
                {activeTab === 'system' && renderSystemSettings()}
              </div>
            </div>
          </DialogBody>

          {/* Footer */}
          <div className="flex-shrink-0 flex items-center justify-end gap-2 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 sm:px-6 sm:py-4">
            <Button variant="ghost" onClick={handleClose}>취소</Button>
            <Button variant="primary" onClick={handleSave} disabled={!hasChanges}>저장</Button>
          </div>
        </div>
      </Dialog>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        open={showRestoreConfirm}
        onClose={() => {
          setShowRestoreConfirm(false)
          setPendingRestore(null)
        }}
        onConfirm={handleRestoreConfirm}
        title="데이터 복원"
        description={`백업 파일에서 데이터를 복원합니다.\n\n버전: ${pendingRestore?.validation.metadata?.version || 'unknown'}\n백업 날짜: ${formatDate(pendingRestore?.validation.metadata?.exportDate)}\n메모 수: ${pendingRestore?.validation.metadata?.memoCount || 0}개\n\n현재 데이터는 덮어쓰기됩니다. 계속하시겠습니까?`}
        confirmText="복원"
        variant="warning"
        isLoading={isRestoring}
      />

      {/* Clear Data Confirmation Dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllData}
        title="모든 데이터 삭제"
        description={'정말로 모든 데이터를 삭제하시겠습니까?\n\n모든 메모와 설정이 영구적으로 삭제됩니다.\n이 작업은 되돌릴 수 없습니다.'}
        confirmText="모두 삭제"
        variant="danger"
      />
    </>
  )
}
