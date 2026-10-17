import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAuthStore } from '@/stores/authStore'
import { useFolderStore } from '@/stores/folderStore'
import { useMemoStore } from '@/stores/memoStore'
import { useUIStore } from '@/stores/uiStore'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogHeader, DialogBody } from '@/components/ui/Dialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FOLDER_COLORS, FONT_SIZES } from '@/utils/constants'
import { ColorSwatchPicker } from '@/components/folders/ColorSwatchPicker'
import {
  createBackup,
  downloadBackup,
  parseBackupFile,
  validateBackup,
  restoreFromBackup,
  clearAllData,
  type BackupValidationResult,
} from '@/services/backup'
import { stopSync } from '@/services/firestoreSync'
import { useToastStore } from '@/stores/toastStore'
import type { InputStartPosition, STTLanguage } from '@/lib/types'
import type { SyncStatus } from '@/lib/types'
import { SyncFolderSection } from './SyncFolderSection'
import { OrphanBackupsSection } from './OrphanBackupsSection'
import { DesktopDownloadSection } from './DesktopDownloadSection'
import { AndroidDownloadSection } from './AndroidDownloadSection'
import { IcFillDelete, IcLineAdd, IcLineCheck, IcLineChevronDown, IcLineChevronRight, IcLineChevronUp, IcLineCloud, IcLineDownload, IcLineEdit, IcLineExternalLink, IcLineEye, IcLineFolder, IcLineLoading, IcLineMoblie, IcLineMy, IcLineShield, IcLineTime, IcLineTrash, IcLineWarning, IcMwCheckCircle, IcMwDayNight, IcMwMoon, IcMwNote, IcMwSun, IcMwUpload } from '@/mw/icons'
import { THEME_LABEL, sunToday, useTheme, type ThemeMode } from '@/mw/theme'
import { TextField } from '@/mw/TextField'
import { GestureSettings } from '@/mw/GestureSettings'

// ─── Theme Options ──────────────────────────────────
// 자동 · 밝게 · 어둡게. 자동은 집의 해를 따라요 (https://ux.moonwave.kr/patterns/theme#rule)
const themeOptions: { value: ThemeMode; icon: React.ReactNode }[] = [
  { value: 'auto', icon: <IcMwDayNight size={16} /> },
  { value: 'light', icon: <IcMwSun size={16} /> },
  { value: 'dark', icon: <IcMwMoon size={16} /> },
]

// ─── Sync Status Badge ──────────────────────────────
function SyncStatusBadge({ status }: { status: SyncStatus }) {
  switch (status) {
    case 'syncing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-800 ">
          <IcLineLoading size={12} className="animate-spin" />
          동기화 중
        </span>
      )
    case 'synced':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-300">
          <IcLineCloud size={12} />
          동기화됨
        </span>
      )
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-danger-100 text-danger-800 dark:bg-danger-900/30 dark:text-danger-300">
          <IcLineWarning size={12} />
          동기화 오류
        </span>
      )
    case 'offline':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-warning-100 text-warning-800 dark:bg-warning-900/30 dark:text-warning-300">
          <IcLineWarning size={12} />
          오프라인 · 연결되면 동기화해요
        </span>
      )
    default:
      return null
  }
}

// ─── Info Banner ────────────────────────────────────
// 파란색 하드코딩 대신 사용자 팔레트를 따르는 공용 안내 배너
function InfoBanner({
  tone = 'info',
  icon,
  children,
  className,
}: {
  tone?: 'info' | 'danger'
  icon: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex items-start gap-2 text-xs p-3 rounded-lg',
        tone === 'info' && 'text-primary-700 bg-primary-50 ',
        tone === 'danger' && 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/10',
        className
      )}
    >
      <span className="shrink-0 mt-0.5" aria-hidden="true">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

// ─── Cloud Sync Section ─────────────────────────────
function CloudSyncSection() {
  const user = useAuthStore((s) => s.user)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const lastSyncTime = useAuthStore((s) => s.lastSyncTime)
  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const isSigningIn = useAuthStore((s) => s.isSigningIn)
  const isSigningOut = useAuthStore((s) => s.isSigningOut)
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

      <div className="p-5 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 shadow-sm">
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
                  <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-lg font-bold ring-2 ring-white dark:ring-zinc-800 shadow-sm">
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
                disabled={isSigningOut}
                className="mw-button mw-button--secondary mw-button--medium"
              >
                {isSigningOut ? '동기화를 마무리하고 있어요' : '로그아웃'}
              </button>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-[var(--color-border-subtle)]">
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm text-zinc-600 dark:text-zinc-400">상태:</span>
                <SyncStatusBadge status={syncStatus} />
              </div>
              {lastSyncTime && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <IcLineTime size={12} />
                  {formatSyncTime(lastSyncTime)}
                </span>
              )}
            </div>

            <InfoBanner icon={<IcLineCloud size={16} />}>
              다른 기기에서 같은 계정으로 로그인하면 자동으로 동기화해요.
            </InfoBanner>
          </div>
        ) : (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-2">
              <IcLineCloud size={32} className="text-primary-500 " />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                기기 간 동기화
              </h4>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                Google 계정으로 로그인하면 모든 기기에서 메모를 동기화할 수 있어요.
              </p>
            </div>
            <Button variant="secondary" onClick={login} loading={isSigningIn}>
              {/* Google의 마크는 Google의 것이라 제 색 그대로, 그림으로 보여요 */}
              {!isSigningIn && <img src="/icons/google-g.png" alt="" width={20} height={20} />}
              {isSigningIn ? '로그인하고 있어요' : 'Google로 로그인'}
            </Button>
            {authError && (
              <InfoBanner tone="danger" icon={<IcLineWarning size={16} />} className="mx-auto max-w-xs text-left">
                {authError}
              </InfoBanner>
            )}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              로그인하지 않아도 이 기기에서는 모든 기능을 쓸 수 있어요.
            </p>
          </div>
        )}
      </div>

      <OrphanBackupsSection />
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
    <div className="flex items-center justify-between p-3 rounded-lg border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50">
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
        aria-label={label}
        onClick={onChange}
        className={`mw-switch mw-switch--medium shrink-0${enabled ? ' mw-switch--checked' : ''}`}
      >
        <div className="mw-switch__container"><div className="mw-switch__handle" /></div>
      </button>
    </div>
  )
}

// ─── Settings Tabs ──────────────────────────────────
type SettingsTab = 'general' | 'account' | 'data' | 'memo' | 'ai' | 'workspace' | 'system'

export function SettingsModal() {
  const isOpen = useUIStore((state) => state.isSettingsModalOpen)
  const closeModal = useUIStore((state) => state.closeSettingsModal)

  const settings = useSettingsStore((s) => s.settings)
  const { mode: themeMode, set: setThemeMode } = useTheme()
  const setFontSize = useSettingsStore((s) => s.setFontSize)
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
  const reorderFolders = useFolderStore((s) => s.reorderFolders)
  const memos = useMemoStore((s) => s.memos)

  // Active (non-deleted) memo count per folder, shown in the folder management list.
  const folderMemoCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const m of memos) {
      if (m.deletedAt || m.folderId == null) continue
      counts.set(m.folderId, (counts.get(m.folderId) ?? 0) + 1)
    }
    return counts
  }, [memos])


  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

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
  const [newFolderColor, setNewFolderColor] = useState<string>(FOLDER_COLORS[4])
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null)
  const [editFolderName, setEditFolderName] = useState('')
  const [editFolderColor, setEditFolderColor] = useState('')
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false)
  const [pendingDeleteFolder, setPendingDeleteFolder] = useState<{ id: number; name: string } | null>(null)
  const [showFolderDropdown, setShowFolderDropdown] = useState(false)

  // AI service states
  const [localOpenAIKey, setLocalOpenAIKey] = useState(settings.ai?.openaiApiKey || '')
  const [localAnthropicKey, setLocalAnthropicKey] = useState(settings.ai?.anthropicApiKey || '')
  const [localGeminiKey, setLocalGeminiKey] = useState(settings.ai?.geminiApiKey || '')
  const [openAIKeySaved, setOpenAIKeySaved] = useState(false)
  const [anthropicKeySaved, setAnthropicKeySaved] = useState(false)
  const [geminiKeySaved, setGeminiKeySaved] = useState(false)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [openAITestResult, setOpenAITestResult] = useState<'success' | 'error' | null>(null)
  const [anthropicTestResult, setAnthropicTestResult] = useState<'success' | 'error' | null>(null)
  const [geminiTestResult, setGeminiTestResult] = useState<'success' | 'error' | null>(null)
  const [showAdvancedKeys, setShowAdvancedKeys] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const contentRef = useRef<HTMLDivElement>(null)

  // Reset scroll position and close dropdowns on tab switch
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
    }
    setShowFolderDropdown(false)
  }, [activeTab])

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

  // Reset transient error state when modal opens
  useEffect(() => {
    if (isOpen) {
      setRestoreError(null)
    }
  }, [isOpen])

  // Sync local AI keys when modal opens
  useEffect(() => {
    if (isOpen) {
      setLocalOpenAIKey(settings.ai?.openaiApiKey || '')
      setLocalAnthropicKey(settings.ai?.anthropicApiKey || '')
      setOpenAIKeySaved(false)
      setAnthropicKeySaved(false)
      setOpenAITestResult(null)
      setAnthropicTestResult(null)
    }
  }, [isOpen, settings.ai?.openaiApiKey, settings.ai?.anthropicApiKey])

  // Debounce OpenAI key save
  useEffect(() => {
    if (!isOpen) return
    if (localOpenAIKey === (settings.ai?.openaiApiKey || '')) return
    setOpenAIKeySaved(false)
    setOpenAITestResult(null)
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
    setAnthropicTestResult(null)
    const timer = setTimeout(() => {
      setAnthropicApiKey(localAnthropicKey)
      if (localAnthropicKey.trim()) setAnthropicKeySaved(true)
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localAnthropicKey])

  // Debounce Gemini key save
  useEffect(() => {
    if (!isOpen) return
    if (localGeminiKey === (settings.ai?.geminiApiKey || '')) return
    setGeminiKeySaved(false)
    setGeminiTestResult(null)
    const timer = setTimeout(() => {
      useSettingsStore.getState().setGeminiApiKey(localGeminiKey)
      if (localGeminiKey.trim()) setGeminiKeySaved(true)
    }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localGeminiKey])

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
      showToast('백업하지 못했어요. 다시 시도해 주세요', 'error')
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
      setRestoreError(result.error || '파일을 읽지 못했어요. 백업 파일이 맞는지 확인해 주세요.')
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
      // Stop Firestore listeners to prevent race condition during restore
      stopSync()

      const parseResult = await parseBackupFile(pendingRestore.file)
      if (!parseResult.success || !parseResult.data) {
        throw new Error('파일을 읽지 못했어요. 백업 파일이 맞는지 확인해 주세요.')
      }

      const result = await restoreFromBackup(parseResult.data)
      if (!result.success) {
        throw new Error(result.error)
      }

      window.location.reload()
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : '복원하지 못했어요. 다시 시도해 주세요.')
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

  // Folder delete confirmation handler
  const handleDeleteFolderConfirm = async () => {
    if (!pendingDeleteFolder) return
    await deleteFolder(pendingDeleteFolder.id)
    showToast(`'${pendingDeleteFolder.name}' 폴더를 지웠어요`, 'info')
    setShowDeleteFolderConfirm(false)
    setPendingDeleteFolder(null)
  }

  // Folder reorder — swap with the adjacent folder and persist the new order.
  // `folders` is already in sortOrder order (system folder excluded); reorderFolders
  // reassigns sortOrder = index to the passed ids and syncs to the cloud.
  const moveFolder = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= folders.length) return
    const ids = folders.map((f) => f.id!)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    reorderFolders(ids)
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '해당 없음'
    try {
      return new Date(dateStr).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return '날짜 미상'
    }
  }

  const defaultFolder = folders.find((f) => f.id === settings.memoSettings.defaultFolderId) || folders.find((f) => f.isDefault)
  const positionLabel: Record<InputStartPosition, string> = { title: '제목', body: '본문' }

  // ─── Tab Content: General ─────────────────────────
  const renderGeneralSettings = () => {
    const sun = sunToday()
    return (
    <div className="space-y-8">

      {/* Theme Selection */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          화면 테마
        </h3>
        <div role="group" aria-label="화면 테마" className="memo-chip-wrap">
          {themeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setThemeMode(option.value)}
              aria-pressed={themeMode === option.value}
              className={`mw-select-chip mw-select-chip--${themeMode === option.value ? 'on' : 'off'}`}
            >
              {option.icon}
              {THEME_LABEL[option.value]}
            </button>
          ))}
        </div>
        {themeMode === 'auto' && sun && (
          <p className="text-xs mt-3 px-1 text-[var(--text-tertiary)]">
            자동은 {sun.place}의 해를 따라요. 오늘은 {sun.rise}에 밝아지고 {sun.set}에 어두워져요.
          </p>
        )}
      </section>

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* 손짓 단계: 키트의 GestureSettings (touch-gestures#settings) */}
      <section>
        <GestureSettings />
      </section>

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* Font Settings */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          글자 설정
        </h3>
        <div className="space-y-4">
          {/* Font Size */}
          <div role="group" aria-label="글자 크기" className="memo-chip-wrap">
            {FONT_SIZES.map((size) => (
              <button
                key={size.id}
                type="button"
                onClick={() => setFontSize(size.id)}
                aria-pressed={settings.fontSize === size.id}
                className={`mw-select-chip mw-select-chip--${settings.fontSize === size.id ? 'on' : 'off'}`}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* App Info */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          앱 정보
        </h3>
        <div className="p-4 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">버전</span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{__APP_VERSION__}</span>
          </div>
          <div className="border-t border-[var(--color-border-subtle)] my-3" />
          <button type="button"
            onClick={() => { closeModal(); setTimeout(() => openTermsModal(), 200) }}
            className="mw-text-button mw-text-button--underline mw-text-button--medium mw-text-button--default"
          >
            <span>서비스 약관 · 개인정보처리방침</span>
          </button>
        </div>
      </section>
    </div>
  )}

  // ─── Tab Content: Account ─────────────────────────
  const renderAccountSettings = () => (
    <div className="space-y-8">
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          프로필 설정
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 shadow-sm">
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
                  <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 text-3xl font-bold ring-4 ring-white dark:ring-zinc-900 shadow-lg">
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
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-50 dark:bg-success-900/20 text-success-600 dark:text-success-400 text-xs font-medium">
                  <IcLineCheck size={12} />
                  Google 계정 연동됨
                </div>
              </div>
            </>
          ) : (
            <div className="w-full text-center py-4">
              <IcLineMy size={48} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Google로 로그인하면 프로필이 자동으로 표시돼요.
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

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* Sync Folder (Phase 1) — 로컬 폴더에 .md 파일로 저장 */}
      <SyncFolderSection />

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* 데스크톱 앱(Windows) 설치본 다운로드 — 비공개 릴리스를 서버 프록시로 제공 */}
      <DesktopDownloadSection />
      <AndroidDownloadSection />

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* Backup & Restore */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          백업 및 복원
        </h3>
        <div className="space-y-3">
          {/* Backup */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/80">
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                백업 내려받기
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
              <IcLineDownload size={16} className="mr-1.5" />
              {isBackingUp ? '백업하고 있어요' : '백업'}
            </Button>
          </div>

          {/* Restore */}
          <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/80">
            <div className="space-y-1">
              <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                데이터 복원
              </div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                백업 파일에서 데이터를 복원해요.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
              >
                <IcMwUpload size={16} className="mr-1.5" />
                {isRestoring ? '복원하고 있어요' : '복원'}
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
            <div className="p-4 rounded-xl bg-danger-50 dark:bg-danger-900/30 border border-danger-200 dark:border-danger-800">
              <div className="flex items-center gap-2 text-danger-700 dark:text-danger-300 mb-1">
                <IcLineWarning size={16} />
                <span className="text-sm font-semibold">복원하지 못했어요</span>
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

  // ─── Tab Content: Memo ────────────────────────────
  const renderMemoSettings = () => (
    <div className="space-y-8">
      {/* Default Folder */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          기본 폴더
        </h3>
        <div className="relative">
          <button
            onClick={() => setShowFolderDropdown(!showFolderDropdown)}
            className="mw-button mw-button--tertiary-subtle mw-button--large w-full justify-between"
          >
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">새 메모 기본 폴더</span>
            <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
              {defaultFolder && (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: defaultFolder.color }}
                />
              )}
              <span>{defaultFolder?.name || '전체 메모'}</span>
              <IcLineChevronRight size={16} className={clsx('  transition-transform', showFolderDropdown && 'rotate-90')} />
            </div>
          </button>
          {showFolderDropdown && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowFolderDropdown(false)} />
              <div className="absolute z-[var(--z-dropdown)] left-0 right-0 mt-1 py-1 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] shadow-[var(--shadow-2)] max-h-48 overflow-y-auto">
                <button type="button"
                  onClick={() => { setDefaultFolder(null); setShowFolderDropdown(false) }}
                  className="mw-sheet__item w-full"
                >
                  <span>전체 메모</span>
                  {!settings.memoSettings.defaultFolderId && <IcLineCheck size={16} className="ml-auto" />}
                </button>
                {folders.map((folder) => (
                  <button type="button"
                    key={folder.id}
                    onClick={() => { setDefaultFolder(folder.id!); setShowFolderDropdown(false) }}
                    className="mw-sheet__item w-full"
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: folder.color }} />
                    <span>{folder.name}</span>
                    {settings.memoSettings.defaultFolderId === folder.id && <IcLineCheck size={16} className="ml-auto" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="border-t border-[var(--color-border-subtle)]" />

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
          className="mw-button mw-button--tertiary-subtle mw-button--large w-full justify-between"
        >
          <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">새 메모 커서 위치</span>
          <div className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span>{positionLabel[settings.memoSettings.inputStartPosition]}</span>
            <IcLineChevronRight size={16} />
          </div>
        </button>
      </section>

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* Toggle Settings */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          추가 기능
        </h3>
        <div className="space-y-3">
          <ToggleItem
            label="'#텍스트'를 입력하면 태그로 바꾸기"
            description="태그로 바꾸면 그 태그가 붙은 메모를 모아 볼 수 있어요."
            enabled={settings.memoSettings.hashtagToTag}
            onChange={toggleHashtagToTag}
          />
          <ToggleItem
            label="링크 미리보기 표시"
            description="URL을 입력하면 링크 미리보기를 함께 보여 줘요."
            enabled={settings.memoSettings.linkPreview}
            onChange={toggleLinkPreview}
          />
        </div>
      </section>

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* Folder Management */}
      <section>
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            폴더 관리
          </h3>
          {!isAddingFolder && (
            <button type="button"
              onClick={() => { setIsAddingFolder(true); setNewFolderName(''); setNewFolderColor(FOLDER_COLORS[4]) }}
              className="mw-button mw-button--tertiary-subtle mw-button--medium mw-button--icon-left"
            >
              <IcLineAdd size={16} />
              새 폴더
            </button>
          )}
        </div>

        <div className="space-y-2">
          {/* Add folder form */}
          {isAddingFolder && (
            <div className="p-3 rounded-xl border border-primary-200 bg-primary-50/50 space-y-3">
              <TextField
                label="폴더 이름"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newFolderName.trim()) {
                    addFolder(newFolderName.trim(), newFolderColor)
                    setIsAddingFolder(false)
                    setNewFolderName('')
                  }
                  if (e.key === 'Escape') setIsAddingFolder(false)
                }}
                showClearButton={false}
              />
              <div className="flex items-center gap-1.5">
                <ColorSwatchPicker value={newFolderColor} onChange={setNewFolderColor} />
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button"
                  onClick={() => setIsAddingFolder(false)}
                  className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
                >
                  <span>취소</span>
                </button>
                <button type="button"
                  onClick={() => {
                    if (newFolderName.trim()) {
                      addFolder(newFolderName.trim(), newFolderColor)
                      setIsAddingFolder(false)
                      setNewFolderName('')
                    }
                  }}
                  disabled={!newFolderName.trim()}
                  className="mw-button mw-button--primary mw-button--medium"
                >
                  만들기
                </button>
              </div>
            </div>
          )}

          {/* Folder list */}
          {folders.length === 0 && !isAddingFolder && (
            <div className="p-4 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 text-center">
              <IcLineFolder size={32} className="mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">아직 폴더가 없어요</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">새 폴더를 추가해 메모를 정리해 보세요</p>
            </div>
          )}

          {folders.map((folder, index) => (
            <div
              key={folder.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50"
            >
              {editingFolderId === folder.id ? (
                <>
                  <div className="flex-1 space-y-2">
                    <TextField
                      label="폴더 이름"
                      value={editFolderName}
                      onChange={(e) => setEditFolderName(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editFolderName.trim()) {
                          updateFolder(folder.id!, { name: editFolderName.trim(), color: editFolderColor })
                          setEditingFolderId(null)
                        }
                        if (e.key === 'Escape') setEditingFolderId(null)
                      }}
                      showClearButton={false}
                    />
                    <div className="flex items-center gap-1.5">
                      <ColorSwatchPicker value={editFolderColor} onChange={setEditFolderColor} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button type="button"
                      onClick={() => {
                        if (editFolderName.trim()) {
                          updateFolder(folder.id!, { name: editFolderName.trim(), color: editFolderColor })
                          setEditingFolderId(null)
                        }
                      }}
                      className="mw-button mw-button--primary mw-button--medium"
                    >
                      저장
                    </button>
                    <button type="button"
                      onClick={() => setEditingFolderId(null)}
                      className="mw-text-button mw-text-button--ghost mw-text-button--medium mw-text-button--default"
                    >
                      <span>취소</span>
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
                  <span
                    className="flex-shrink-0 inline-flex items-center gap-1 text-xs tabular-nums text-zinc-500 dark:text-zinc-400"
                    aria-label={`메모 ${folderMemoCounts.get(folder.id!) ?? 0}개`}
                  >
                    <IcMwNote size={12} />
                    {folderMemoCounts.get(folder.id!) ?? 0}
                  </span>
                  {!folder.isSystem && (
                    <div className="flex items-center gap-1">
                      {/* 순서 변경 ▲▼ — 인접 폴더와 스왑 (경계에서 비활성) */}
                      <div className="flex flex-col -my-2">
                        <button type="button"
                          onClick={() => moveFolder(index, -1)}
                          disabled={index === 0}
                          className="mw-icon-button"
                          aria-label={`${folder.name} 위로 이동`}
                        >
                          <IcLineChevronUp size={16} />
                        </button>
                        <button type="button"
                          onClick={() => moveFolder(index, 1)}
                          disabled={index === folders.length - 1}
                          className="mw-icon-button"
                          aria-label={`${folder.name} 아래로 이동`}
                        >
                          <IcLineChevronDown size={16} />
                        </button>
                      </div>
                      {/* 40px 최소 터치 타깃 확보 (-m으로 레이아웃 밀도 유지) */}
                      <button type="button"
                        onClick={() => {
                          setEditingFolderId(folder.id!)
                          setEditFolderName(folder.name)
                          setEditFolderColor(folder.color)
                        }}
                        className="mw-icon-button -my-2"
                        aria-label={`${folder.name} 편집`}
                      >
                        <IcLineEdit size={16} />
                      </button>
                      <button type="button"
                        onClick={() => {
                          setPendingDeleteFolder({ id: folder.id!, name: folder.name })
                          setShowDeleteFolderConfirm(true)
                        }}
                        className="mw-icon-button -my-2"
                        aria-label={`${folder.name} 지우기`}
                      >
                        <IcLineTrash size={16} />
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
  const handleTestConnection = async (provider: 'openai' | 'anthropic' | 'gemini') => {
    const key = provider === 'openai' ? localOpenAIKey : provider === 'anthropic' ? localAnthropicKey : localGeminiKey
    if (!key.trim()) {
      showToast('API 키를 먼저 입력해 주세요', 'warning')
      return
    }
    setTestingProvider(provider)
    const setResult = provider === 'openai' ? setOpenAITestResult : provider === 'anthropic' ? setAnthropicTestResult : setGeminiTestResult
    setResult(null)
    try {
      let res: Response
      if (provider === 'anthropic') {
        res = await fetch('https://api.anthropic.com/v1/models', {
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
          },
        })
      } else if (provider === 'gemini') {
        res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
      } else {
        res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        })
      }
      if (res.ok) {
        setResult('success')
        showToast('연결했어요', 'success')
      } else {
        setResult('error')
        showToast('연결하지 못했어요. API 키를 확인해 주세요', 'error')
      }
    } catch {
      setResult('error')
      showToast('연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요', 'error')
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

  const renderAISettings = () => {
    const hasAnyKey = !!(localOpenAIKey.trim() || localAnthropicKey.trim() || localGeminiKey.trim())
    const aiUsage = (() => { try { const raw = localStorage.getItem('memo-ai-usage'); if (!raw) return { count: 0 }; const d = JSON.parse(raw); return d.date === new Date().toISOString().slice(0, 10) ? d : { count: 0 } } catch { return { count: 0 } } })()
    const providerOptions = [
      { value: 'openai' as const, label: 'OpenAI (GPT-4.1 nano)' },
      { value: 'anthropic' as const, label: 'Anthropic (Claude 4.6)' },
      { value: 'gemini' as const, label: 'Google (Gemini 2.5)' },
    ]
    const ocrProviderOptions = [
      { value: 'openai' as const, label: 'OpenAI (GPT-4o)' },
      { value: 'anthropic' as const, label: 'Anthropic (Claude 4.6)' },
      { value: 'gemini' as const, label: 'Google (Gemini 2.5)' },
    ]
    return (
    <div className="space-y-8">
      {/* AI status banner */}
      <div className="rounded-xl bg-primary-50 border border-primary-100 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse" />
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI 기능을 쓸 수 있어요</span>
        </div>
        {hasAnyKey ? (
          <p className="text-xs text-primary-600 ">내 API 키로 한도 없이 쓰고 있어요</p>
        ) : (
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            오늘 사용: <span className="font-semibold text-zinc-900 dark:text-zinc-100">{aiUsage.count}/50회</span> (서버 키)
            {aiUsage.count >= 50 && <span className="text-danger-500 ml-1">한도를 넘었어요</span>}
          </p>
        )}
      </div>

      {/* Provider Selection */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">기본 설정</h3>
        <div className="p-4 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 space-y-5">
          {/* AI Provider */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">AI 제공자</label>
            <div role="group" aria-label="AI 제공자" className="memo-chip-wrap">
              {providerOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => useSettingsStore.getState().setAIProvider(opt.value)}
                  aria-pressed={settings.ai?.aiProvider === opt.value}
                  className={`mw-select-chip mw-select-chip--${settings.ai?.aiProvider === opt.value ? 'on' : 'off'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* OCR Provider */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">OCR 제공자</label>
            <div role="group" aria-label="글자 인식 제공자" className="memo-chip-wrap">
              {ocrProviderOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => useSettingsStore.getState().setOCRProvider(opt.value)}
                  aria-pressed={settings.ai?.ocrProvider === opt.value}
                  className={`mw-select-chip mw-select-chip--${settings.ai?.ocrProvider === opt.value ? 'on' : 'off'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* STT Language */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">음성 인식 언어</label>
            <div role="group" aria-label="음성 인식 언어" className="memo-chip-wrap">
              {languageOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSTTLanguage(opt.value)}
                  aria-pressed={settings.ai?.language === opt.value}
                  className={`mw-select-chip mw-select-chip--${settings.ai?.language === opt.value ? 'on' : 'off'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Autocomplete */}
          <ToggleItem
            label="AI 자동완성"
            description="입력하는 동안 AI가 다음 문장을 제안해요 (Tab으로 수락)"
            enabled={settings.ai?.aiAutocomplete ?? false}
            onChange={() => useSettingsStore.getState().toggleAIAutocomplete()}
          />
        </div>
      </section>

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* Advanced: Custom API Keys */}
      <section>
        <button type="button"
          onClick={() => setShowAdvancedKeys(!showAdvancedKeys)}
          className="mw-button mw-button--tertiary-subtle mw-button--medium mw-button--icon-left w-full"
        >
          <IcLineChevronDown size={16} className={clsx('  transition-transform', showAdvancedKeys && 'rotate-180')} />
          고급: 내 API 키 등록 (무제한)
        </button>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 px-1 mb-4">
          키를 등록하면 서버 키 대신 내 키를 써요. 하루 사용 한도 없이 AI 기능을 쓸 수 있어요.
        </p>

        {showAdvancedKeys && (
          <div className="p-4 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50 space-y-5">
            {/* OpenAI Key */}
            <div>
              <div className="flex items-center justify-end mb-2">
                <div className="flex items-center gap-2">
                  {openAITestResult === 'success' && <span className="text-xs text-success-600"><IcMwCheckCircle size={12} className="inline" /> 연결됨</span>}
                  {openAITestResult === 'error' && <span className="text-xs text-danger-500"><IcFillDelete size={12} className="inline" /> 실패</span>}
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary-500 hover:text-primary-600"><IcLineExternalLink size={12} className="inline" /> 발급</a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TextField label="OpenAI API 키" inputType="password" value={localOpenAIKey} onChange={(e) => setLocalOpenAIKey(e.target.value)} autoComplete="off" showClearButton={false} containerClassName="min-w-0 flex-1" />
                <button type="button" onClick={() => handleTestConnection('openai')} disabled={!localOpenAIKey.trim() || testingProvider === 'openai'} className="mw-button mw-button--tertiary-subtle mw-button--medium">{testingProvider === 'openai' ? <IcLineLoading size={16} className="animate-spin" /> : '테스트'}</button>
              </div>
              {openAIKeySaved && localOpenAIKey.trim() && <p className="mt-1 text-xs text-success-600 flex items-center gap-1"><IcLineCheck size={12} /> 저장됨</p>}
            </div>

            {/* Anthropic Key */}
            <div>
              <div className="flex items-center justify-end mb-2">
                <div className="flex items-center gap-2">
                  {anthropicTestResult === 'success' && <span className="text-xs text-success-600"><IcMwCheckCircle size={12} className="inline" /> 연결됨</span>}
                  {anthropicTestResult === 'error' && <span className="text-xs text-danger-500"><IcFillDelete size={12} className="inline" /> 실패</span>}
                  <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-xs text-primary-500 hover:text-primary-600"><IcLineExternalLink size={12} className="inline" /> 발급</a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TextField label="Anthropic API 키" inputType="password" value={localAnthropicKey} onChange={(e) => setLocalAnthropicKey(e.target.value)} autoComplete="off" showClearButton={false} containerClassName="min-w-0 flex-1" />
                <button type="button" onClick={() => handleTestConnection('anthropic')} disabled={!localAnthropicKey.trim() || testingProvider === 'anthropic'} className="mw-button mw-button--tertiary-subtle mw-button--medium">{testingProvider === 'anthropic' ? <IcLineLoading size={16} className="animate-spin" /> : '테스트'}</button>
              </div>
              {anthropicKeySaved && localAnthropicKey.trim() && <p className="mt-1 text-xs text-success-600 flex items-center gap-1"><IcLineCheck size={12} /> 저장됨</p>}
            </div>

            {/* Gemini Key */}
            <div>
              <div className="flex items-center justify-end mb-2">
                <div className="flex items-center gap-2">
                  {geminiTestResult === 'success' && <span className="text-xs text-success-600"><IcMwCheckCircle size={12} className="inline" /> 연결됨</span>}
                  {geminiTestResult === 'error' && <span className="text-xs text-danger-500"><IcFillDelete size={12} className="inline" /> 실패</span>}
                  <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-primary-500 hover:text-primary-600"><IcLineExternalLink size={12} className="inline" /> 발급</a>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TextField label="Gemini API 키" inputType="password" value={localGeminiKey} onChange={(e) => setLocalGeminiKey(e.target.value)} autoComplete="off" showClearButton={false} containerClassName="min-w-0 flex-1" />
                <button type="button" onClick={() => handleTestConnection('gemini')} disabled={!localGeminiKey.trim() || testingProvider === 'gemini'} className="mw-button mw-button--tertiary-subtle mw-button--medium">{testingProvider === 'gemini' ? <IcLineLoading size={16} className="animate-spin" /> : '테스트'}</button>
              </div>
              {geminiKeySaved && localGeminiKey.trim() && <p className="mt-1 text-xs text-success-600 flex items-center gap-1"><IcLineCheck size={12} /> 저장됨</p>}
            </div>
          </div>
        )}
      </section>

      {/* Info */}
      <section>
        <InfoBanner icon={<IcLineShield size={16} />}>
          API 키를 등록하지 않아도 하루 50회까지 무료로 AI 기능을 쓸 수 있어요. 등록한 키는 이 기기에만 저장해요.
        </InfoBanner>
      </section>
    </div>
  )}

  // ─── Tab Content: System ──────────────────────────
  const renderSystemSettings = () => (
    <div className="space-y-8">
      {/* PWA Install */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          앱 설치
        </h3>
        <div className="p-4 rounded-xl border border-[var(--color-border-subtle)] bg-white dark:bg-zinc-900/50">
          {isInstalled ? (
            <div className="flex items-center gap-3 p-3 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 rounded-lg">
              <div className="w-8 h-8 rounded-full bg-success-100 dark:bg-success-900/40 flex items-center justify-center">
                <IcLineMoblie size={16} />
              </div>
              <span className="text-sm font-medium">앱이 이미 설치되어 있어요</span>
            </div>
          ) : canInstallPWA ? (
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 space-y-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  앱으로 설치하기
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  홈 화면에 추가하면 네이티브 앱처럼 더 빠르고 편리하게 쓸 수 있어요.
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleInstallPWA}
              >
                <IcLineDownload size={16} className="mr-1.5" />
                설치하기
              </Button>
            </div>
          ) : (
            <div className="text-sm text-zinc-500 dark:text-zinc-400">
              <p className="mb-2">
                브라우저 메뉴에서 "홈 화면에 추가"를 고르면 앱을 설치할 수 있어요.
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

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* High Contrast Mode */}
      <section>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 px-1">
          접근성
        </h3>
        <ToggleItem
          icon={<IcLineEye size={16} />}
          label="고대비 모드"
          description="글자와 화면 요소의 대비를 높여 더 읽기 쉽게 해요"
          enabled={settings.highContrastMode ?? false}
          onChange={() => useSettingsStore.getState().toggleHighContrast()}
        />
      </section>

      <div className="border-t border-[var(--color-border-subtle)]" />

      {/* Danger Zone */}
      <section>
        <h3 className="text-sm font-semibold text-danger-600 dark:text-danger-400 mb-4 px-1">
          위험 영역
        </h3>
        <div className="flex items-center justify-between p-4 rounded-xl border border-danger-200 dark:border-danger-800 bg-danger-50 dark:bg-danger-900/10">
          <div className="space-y-0.5">
            <div className="text-sm font-medium text-danger-700 dark:text-danger-300">
              모든 데이터 지우기
            </div>
            <div className="text-xs text-danger-600/80 dark:text-danger-400/80">
              모든 메모와 설정을 지워요. 지운 데이터는 되돌릴 수 없어요.
            </div>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
          >
            <IcLineTrash size={16} className="mr-1.5" />
            지우기
          </Button>
        </div>
      </section>
    </div>
  )

  // ─── Tab Content: Workspace ─────────────────────────
  const renderWorkspaceSettings = () => {
    const lw = settings.livingWorkspace
    const handleToggle = (key: keyof typeof lw) => {
      useSettingsStore.getState().updateLivingWorkspace({ [key]: !lw[key] })
    }

    return (
      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1 px-1">
            Living Workspace
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 px-1">
            환경과 행동에 반응하는 생동감 있는 작업 공간을 설정해요
          </p>

          <div className="space-y-3">
            <ToggleItem label="날씨와 위치 맥락" description="메모에 쓴 때의 날씨와 낮밤을 함께 적고, 상단 바에 날씨를 보여 줘요" enabled={lw.environmentThemeEnabled} onChange={() => handleToggle('environmentThemeEnabled')} />
            <ToggleItem label="타임캡슐" description="지난해 같은 날에 쓴 메모를 알려 줘요" enabled={lw.timeCapsuleEnabled} onChange={() => handleToggle('timeCapsuleEnabled')} />
            <ToggleItem label="사운드 동기화" description="조작할 때 테마에 맞는 소리를 들려줘요" enabled={lw.soundSyncEnabled} onChange={() => handleToggle('soundSyncEnabled')} />
          </div>
        </section>

        {/* Beyond UX: 감각 경험 */}
        <section>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1 px-1">
            감각 경험
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 px-1">
            여러 감각으로 글쓰기에 몰입하게 돕는 기능이에요
          </p>
          <div className="space-y-3">
            <ToggleItem label="디지털 정원" description="오래 둔 메모는 색이 바래고, 자주 쓰는 메모는 빛나요" enabled={lw.digitalGardenEnabled} onChange={() => handleToggle('digitalGardenEnabled')} />
            <ToggleItem label="호흡 타이포그래피" description="빠르게 입력하면 글자 사이가 심호흡 리듬으로 움직여요" enabled={lw.breathingTypographyEnabled} onChange={() => handleToggle('breathingTypographyEnabled')} />
            <ToggleItem label="소멸의 공간 (브레인 덤프)" description="한 시간 뒤에 저절로 사라지는 임시 메모 모드예요" enabled={lw.ephemeralBrainDumpEnabled} onChange={() => handleToggle('ephemeralBrainDumpEnabled')} />
            <ToggleItem label="앰비언트 사운드스케이프" description="글을 입력하면 앰비언트 음악이 만들어져요" enabled={lw.ambientSoundscapeEnabled} onChange={() => handleToggle('ambientSoundscapeEnabled')} />
          </div>
        </section>

        {/* Beyond UX: 지능형 보조 */}
        <section>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1 px-1">
            지능형 보조
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 px-1">
            맥락을 이해하는 스마트 기능이에요
          </p>
          <div className="space-y-3">
            <ToggleItem label="공감각 타임머신" description="예전 메모를 열면 쓸 때의 환경(날씨/시간)을 다시 보여 줘요" enabled={lw.timeMachineEnabled} onChange={() => handleToggle('timeMachineEnabled')} />
            <ToggleItem label="맥락 자동 제안" description="시간과 요일 패턴을 보고 필요한 메모를 자동으로 추천해요" enabled={lw.contextSurfacingEnabled} onChange={() => handleToggle('contextSurfacingEnabled')} />
          </div>
        </section>

        {/* Beyond UX: AI 고급 */}
        <section>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1 px-1">
            AI 고급
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 px-1">
            AI API를 쓰는 고급 기능이에요 (API 키 필요)
          </p>
          <div className="space-y-3">
            <ToggleItem label="시맨틱 캔버스" description="뜻이 비슷한 메모끼리 2D 화면에 모아 보여 줘요 (OpenAI 키 필요)" enabled={lw.semanticCanvasEnabled} onChange={() => handleToggle('semanticCanvasEnabled')} />
            <ToggleItem label="데미안 모드 (AI 대화)" description="내 예전 글쓰기 스타일을 닮은 AI가 소크라테스식으로 묻고 답해요 (API 키 필요)" enabled={lw.alterEgoEnabled} onChange={() => handleToggle('alterEgoEnabled')} />
          </div>
        </section>
      </div>
    )
  }

  // ─── Tab Definitions ──────────────────────────────
  const tabs: { id: SettingsTab; label: string }[] = [
    { id: 'general', label: '일반' },
    { id: 'account', label: '계정' },
    { id: 'data', label: '데이터' },
    { id: 'memo', label: '메모' },
    { id: 'ai', label: 'AI 서비스' },
    { id: 'workspace', label: '작업 공간' },
    { id: 'system', label: '시스템' },
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
      <Dialog open={isOpen} onClose={closeModal} size="4xl" noPadding full>
        {/* 폰에서는 화면 전체, 넓은 화면에서는 내용만큼(가장 높아도 800px) */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-none sm:max-h-[800px]">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 sm:px-6 sm:pt-5 sm:pb-4">
            <DialogHeader title="설정" onClose={closeModal} />
          </div>

          {/* Body: Sidebar Tabs + Content */}
          <DialogBody className="p-0 overflow-hidden flex-1 min-h-0 flex flex-col">
            {/* 탭: 키트의 Scrollable 탭이에요 */}
            <div className="mw-tab-group mw-tab-group--scrollable shrink-0 px-4 sm:px-6" role="tablist" aria-label="설정 탭">
              {tabs.map((tab, index) => (
                <button
                  key={tab.id}
                  type="button"
                  ref={(el) => { tabRefs.current[index] = el }}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, index)}
                  className={`mw-tab mw-tab--scrollable mw-tab--${activeTab === tab.id ? 'selected' : 'default'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Area — 패널(--dialog-bg) 표면을 그대로 사용해 헤더와 이음새 없이 연결 */}
            <div ref={contentRef} className="flex-1 min-w-0 overflow-y-auto">
              <div className="max-w-2xl mx-auto p-4 md:p-6 lg:p-8">
                {activeTab === 'general' && renderGeneralSettings()}
                {activeTab === 'account' && renderAccountSettings()}
                {activeTab === 'data' && renderDataSettings()}
                {activeTab === 'memo' && renderMemoSettings()}
                {activeTab === 'ai' && renderAISettings()}
                {activeTab === 'workspace' && renderWorkspaceSettings()}
                {activeTab === 'system' && renderSystemSettings()}
              </div>
            </div>
          </DialogBody>
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
        title="데이터를 복원할까요?"
        description={`백업 파일의 데이터로 복원해요.\n\n버전: ${pendingRestore?.validation.metadata?.version || '미상'}\n백업 날짜: ${formatDate(pendingRestore?.validation.metadata?.exportDate)}\n메모 수: ${pendingRestore?.validation.metadata?.memoCount || 0}개\n\n지금 있는 데이터는 백업 파일의 데이터로 덮어써요.`}
        confirmText="복원"
        variant="warning"
        isLoading={isRestoring}
      />

      {/* Clear Data Confirmation Dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAllData}
        title="모든 데이터를 지울까요?"
        description={'모든 메모와 설정을 완전히 지워요.\n지운 데이터는 되돌릴 수 없어요.'}
        confirmText="모두 지우기"
        variant="danger"
      />

      {/* Folder Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteFolderConfirm}
        onClose={() => {
          setShowDeleteFolderConfirm(false)
          setPendingDeleteFolder(null)
        }}
        onConfirm={handleDeleteFolderConfirm}
        title="폴더를 지울까요?"
        description={`'${pendingDeleteFolder?.name}' 폴더를 지워요.\n안에 있던 메모는 기본 폴더로 옮겨져요.`}
        confirmText="지우기"
        variant="danger"
      />
    </>
  )
}
