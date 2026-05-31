import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { WifiOff } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { BottomNav } from './components/layout/BottomNav'
import { MobileNav } from './components/layout/MobileNav'
import { Footer } from './components/layout/Footer'
import { UndoToast } from './components/ui/UndoToast'
import { ToastContainer } from './components/ui/Toast'
import { UpdateBanner } from './components/ui/UpdateBanner'
import { AppLoadingScreen } from './components/ui/AppLoadingScreen'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { FAB } from './components/ui/FAB'
import { AmbientBackground } from './components/ui/AmbientBackground'
import { EdgeLighting } from './components/ui/EdgeLighting'
import { LockScreen } from './components/ui/LockScreen'
import { useAppLockStore } from './hooks/useAppLock'
import { clearAppBadge } from './utils/badge'

// PERF: Lazy-load heavy modals (not needed on initial render)
const SettingsModal = lazy(() => import('./components/layout/SettingsModal').then((m) => ({ default: m.SettingsModal })))
const TermsModal = lazy(() => import('./components/layout/TermsModal').then((m) => ({ default: m.TermsModal })))
const FAQModal = lazy(() => import('./components/layout/FAQModal').then((m) => ({ default: m.FAQModal })))
const CommandPalette = lazy(() => import('./components/ui/CommandPalette').then((m) => ({ default: m.CommandPalette })))
const KeyboardShortcutsModal = lazy(() => import('./components/ui/KeyboardShortcutsModal').then((m) => ({ default: m.KeyboardShortcutsModal })))
const SlideView = lazy(() => import('./components/slideview/SlideView').then((m) => ({ default: m.SlideView })))
const FolderSelectModal = lazy(() => import('./components/folders/FolderSelectModal').then((m) => ({ default: m.FolderSelectModal })))
const TemplateSelectModal = lazy(() => import('./components/editor/TemplateSelectModal').then((m) => ({ default: m.TemplateSelectModal })))
const VoiceUploadModal = lazy(() => import('./components/voice/VoiceUploadModal').then((m) => ({ default: m.VoiceUploadModal })))
const ImageOCRModal = lazy(() => import('./components/ocr/ImageOCRModal').then((m) => ({ default: m.ImageOCRModal })))
const IOSInstallBanner = lazy(() => import('./components/ui/IOSInstallBanner').then((m) => ({ default: m.IOSInstallBanner })))
const TimeCapsuleBanner = lazy(() => import('./components/ui/TimeCapsuleBanner').then((m) => ({ default: m.TimeCapsuleBanner })))
const FloatingTimer = lazy(() => import('./components/editor/FloatingTimer').then((m) => ({ default: m.FloatingTimer })))
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useCognitiveLoadDetector } from '@/hooks/useCognitiveLoadDetector'
import { useEphemeralGarbageCollector } from '@/hooks/useEphemeralGarbageCollector'
import { useContextSurfacing } from '@/hooks/useContextSurfacing'
import { ContextSuggestionBanner } from './components/ui/ContextSuggestionBanner'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { useAuthStore } from './stores/authStore'
import { useUndoStore } from './stores/undoStore'
import { useThemeOrchestrator } from './stores/themeOrchestratorStore'
import { registerRefreshCallbacks } from './services/firestoreSync'
import { getCachedPosition, requestAndCachePosition, getSolarMode } from './services/solarCalculator'
import { fetchWeather } from './services/weatherService'
import { MEDIA } from '@/utils/breakpoints'

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()
  const initializeMemos = useMemoStore((state) => state.initialize)
  const initializeFolders = useFolderStore((state) => state.initialize)
  const initSettings = useSettingsStore((state) => state.initialize)
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen)
  const isTablet = useUIStore((state) => state.isTablet)
  const tabletSidebarOpen = useUIStore((state) => state.tabletSidebarOpen)
  const isFocusMode = useUIStore((state) => state.isFocusMode)
  // Tablet rail keeps its own collapse state; mirror it for the content offset.
  const sidebarExpanded = isTablet ? tabletSidebarOpen : isSidebarOpen

  // PERF: Subscribe to modal open states for conditional lazy rendering
  const isSettingsOpen = useUIStore((s) => s.isSettingsModalOpen)
  const isTermsOpen = useUIStore((s) => s.isTermsModalOpen)
  const isFAQOpen = useUIStore((s) => s.isFAQModalOpen)
  const isFolderSelectOpen = useUIStore((s) => s.isFolderSelectOpen)
  const isTemplateOpen = useUIStore((s) => s.isTemplateModalOpen)
  const isVoiceOpen = useUIStore((s) => s.isVoiceModalOpen)
  const isImageOCROpen = useUIStore((s) => s.isImageOCRModalOpen)
  const isCommandPaletteOpen = useUIStore((s) => s.isCommandPaletteOpen)
  const isShortcutsOpen = useUIStore((s) => s.isKeyboardShortcutsOpen)
  const slideViewMemoId = useUIStore((s) => s.slideViewMemoId)

  // ─── App Lock: auto-lock on inactivity ───
  const appLockEnabled = useSettingsStore((s) => s.settings.appLock?.enabled)
  const appLockTimeout = useSettingsStore((s) => s.settings.appLock?.timeoutMinutes ?? 5)
  const lockApp = useAppLockStore((s) => s.lock)

  useEffect(() => {
    if (!appLockEnabled) return
    let lastActivity = Date.now()
    const handleActivity = () => { lastActivity = Date.now() }
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - lastActivity > appLockTimeout * 60 * 1000) lockApp()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    document.addEventListener('pointerdown', handleActivity)
    document.addEventListener('keydown', handleActivity)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      document.removeEventListener('pointerdown', handleActivity)
      document.removeEventListener('keydown', handleActivity)
    }
  }, [appLockEnabled, appLockTimeout, lockApp])

  // ─── Badge clear + Background sync listener ───
  useEffect(() => {
    clearAppBadge()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') clearAppBadge()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    // Online event → process pending syncs
    const handleOnline = () => {
      import('./services/offlineQueue').then(({ processPendingSyncs }) => processPendingSyncs())
    }
    window.addEventListener('online', handleOnline)

    // SW message → process pending syncs
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_PENDING_MEMOS') {
        import('./services/offlineQueue').then(({ processPendingSyncs }) => processPendingSyncs())
      }
    }
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  // A11Y: Theme change sr-only announcement
  const theme = useSettingsStore((state) => state.settings.theme)
  const [themeAnnouncement, setThemeAnnouncement] = useState('')
  const prevTheme = useRef(theme)
  useEffect(() => {
    if (prevTheme.current !== theme) {
      const labels: Record<string, string> = { light: '라이트 모드', dark: '다크 모드', system: '시스템 설정' }
      setThemeAnnouncement(`테마가 ${labels[theme] || theme}(으)로 변경되었습니다`)
      prevTheme.current = theme
      const t = setTimeout(() => setThemeAnnouncement(''), 3000)
      return () => clearTimeout(t)
    }
  }, [theme])

  useEffect(() => {
    const initApp = async () => {
      try {
        await Promise.all([
          initializeMemos(),
          initializeFolders(),
        ])
        initSettings()

        // Seed welcome memos on first visit
        const memoCount = useMemoStore.getState().memos.length
        const hasOnboarded = useSettingsStore.getState().settings.hasCompletedOnboarding
        if (memoCount === 0 && !hasOnboarded) {
          await useMemoStore.getState().seedWelcomeMemos()
          useSettingsStore.getState().setHasCompletedOnboarding(true)
        }

        registerRefreshCallbacks(
          () => useMemoStore.getState().refreshFromDb(),
          () => useFolderStore.getState().refreshFromDb(),
        )
        useAuthStore.getState().initialize()

        // Re-resolve orchestrator after initSettings to restore environment/event palette
        useThemeOrchestrator.getState().resolve()
      } finally {
        setIsInitialized(true)
      }
    }

    initApp()
  }, [initializeMemos, initializeFolders, initSettings])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z: Undo (only for memo deletion undo — skip when inside text inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'TEXTAREA' || tag === 'INPUT') return // let editor handle its own undo
        e.preventDefault()
        useUndoStore.getState().undo()
      }
      // Ctrl+N: New memo
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        navigate('/memo/new')
      }
      // Ctrl+K: Command palette (skip in textarea — editor handles Ctrl+K for links)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'TEXTAREA') return // let editor handle link insertion
        e.preventDefault()
        const ui = useUIStore.getState()
        if (ui.isCommandPaletteOpen) {
          ui.closeCommandPalette()
        } else {
          ui.openCommandPalette()
        }
      }
      // Escape: Exit focus mode
      if (e.key === 'Escape') {
        const ui = useUIStore.getState()
        if (ui.isCommandPaletteOpen) {
          ui.closeCommandPalette()
        } else if (ui.isFocusMode) {
          ui.toggleFocusMode()
        }
      }
      // Ctrl+/: Keyboard shortcuts help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        useUIStore.getState().openKeyboardShortcuts()
      }
      // F5 or Ctrl+Shift+P: Slide view (only in editor route)
      // Use window.location to avoid stale closure (this handler has [] deps)
      const currentPath = window.location.pathname
      const isEditorRoute = currentPath.startsWith('/memo/')
      if (isEditorRoute && (
        e.key === 'F5' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p')
      )) {
        e.preventDefault()
        const memoIdStr = currentPath.split('/memo/')[1]
        const memoId = Number(memoIdStr)
        if (memoId && !isNaN(memoId)) {
          useUIStore.getState().openSlideView(memoId)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // F-09: Galaxy Fold narrow screen detection
  useEffect(() => {
    const mql = window.matchMedia(MEDIA.fold)
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const isFold = e.matches
      useUIStore.setState({ isNarrowFold: isFold })
      document.documentElement.toggleAttribute('data-narrow-fold', isFold)
    }
    handleChange(mql) // Initial check
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  // Desktop breakpoint detection (single source of truth)
  useEffect(() => {
    const mql = window.matchMedia(MEDIA.desktop)
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      useUIStore.setState({ isDesktop: e.matches })
    }
    handleChange(mql)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  // Wide desktop breakpoint detection (xl: 1280px+)
  useEffect(() => {
    const mql = window.matchMedia(MEDIA.wideDesktop)
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      useUIStore.setState({ isWideDesktop: e.matches })
    }
    handleChange(mql)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  // Mobile tier detection (≤767px: touch-first, bottom nav)
  useEffect(() => {
    const mql = window.matchMedia(MEDIA.mobile)
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      useUIStore.setState({ isMobile: e.matches })
    }
    handleChange(mql)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  // Tablet tier detection (768–1023px: compact sidebar shell)
  useEffect(() => {
    const mql = window.matchMedia(MEDIA.tabletOnly)
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      useUIStore.setState({ isTablet: e.matches })
    }
    handleChange(mql)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  // Global keyboard state sync via VisualViewport API
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const isOpen = vv.height < window.innerHeight * 0.75
      useUIStore.getState().setKeyboardState(isOpen, isOpen ? window.innerHeight - vv.height : 0)
    }
    update()
    vv.addEventListener('resize', update)
    return () => vv.removeEventListener('resize', update)
  }, [])

  // Living Workspace: Cognitive load detector
  useCognitiveLoadDetector()

  // Beyond UX: Ephemeral brain-dump garbage collector
  useEphemeralGarbageCollector()

  // Beyond UX: Context-aware zero-click surfacing
  const contextSurfacingEnabled = useSettingsStore((s) => s.settings.livingWorkspace.contextSurfacingEnabled)
  const { suggestedMemo, dismiss: dismissContextSuggestion } = useContextSurfacing(contextSurfacingEnabled)

  // Living Workspace: Environment sync (solar + weather)
  const environmentThemeEnabled = useSettingsStore((s) => s.settings.livingWorkspace.environmentThemeEnabled)
  useEffect(() => {
    if (!environmentThemeEnabled) {
      // 꺼지면 환경 시그널 초기화 → 사용자 기본 팔레트로 복원
      useThemeOrchestrator.getState().setEnvironment(null, null, null)
      return
    }

    const syncEnvironment = async () => {
      let pos = getCachedPosition()
      if (!pos) pos = await requestAndCachePosition()
      if (!pos) return

      const solarMode = getSolarMode(pos.latitude, pos.longitude)
      const weather = await fetchWeather(pos.latitude, pos.longitude)

      useThemeOrchestrator.getState().setEnvironment(
        weather?.condition ?? null,
        weather?.temperature ?? null,
        solarMode
      )
    }

    syncEnvironment()
    const interval = setInterval(syncEnvironment, 60 * 60 * 1000) // every hour
    return () => clearInterval(interval)
  }, [environmentThemeEnabled])

  // Living Workspace: resolve orchestrator on settings change
  useEffect(() => {
    useThemeOrchestrator.getState().resolve()
  }, [])

  // Sync currentView with URL
  const location = useLocation()
  const setCurrentView = useUIStore((state) => state.setCurrentView)
  const isMemoRoute = location.pathname === '/memos' || location.pathname.startsWith('/memo/')

  useEffect(() => {
    const pathname = location.pathname
    if (pathname === '/') {
      setCurrentView('dashboard')
    } else if (pathname === '/memos' || pathname.startsWith('/memo/')) {
      setCurrentView('memos')
    } else if (pathname === '/calendar') {
      setCurrentView('calendar')
    }
  }, [location.pathname, setCurrentView])

  if (!isInitialized) {
    return <AppLoadingScreen />
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col">
      <AmbientBackground />

      {/* A11Y: sr-only theme change announcement */}
      {themeAnnouncement && (
        <div className="sr-only" role="status" aria-live="polite">{themeAnnouncement}</div>
      )}

      {/* Offline banner */}
      {!isOnline && (
        <div role="alert" className="sticky top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 bg-warning-500 text-white text-sm font-medium">
          <WifiOff className="w-4 h-4" />
          오프라인 상태입니다. 변경사항은 연결 복구 시 동기화됩니다.
        </div>
      )}

      {!isFocusMode && <Sidebar />}

      <div
        className={clsx(
          // PERF-04: removed transition-all duration-300 (sidebar has its own transition)
          // Sidebar appears at md+ (tablet & desktop); mobile (<md) uses bottom nav, no margin.
          'flex-1 flex flex-col',
          !isFocusMode && (sidebarExpanded ? 'md:ml-64' : 'md:ml-16')
        )}
      >
        {!isFocusMode && <Header />}
        <main
          id="main-content"
          aria-live="polite"
          className={clsx(
            'flex-1',
            // pb-20 clears the mobile bottom nav; removed at md+ where the sidebar replaces it
            isFocusMode ? '' : 'pb-20',
            !isFocusMode && (isMemoRoute ? 'md:pb-0 lg:overflow-hidden' : 'md:pb-6')
          )}
        >
          {/* TECH-02: ErrorBoundary wraps route content */}
          <ErrorBoundary>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
        {!isMemoRoute && !isFocusMode && <Footer />}
      </div>

      {!isFocusMode && <FAB />}
      {!isFocusMode && <BottomNav />}
      {!isFocusMode && <MobileNav />}

      {/* Global Modals — lazy loaded, rendered only when open */}
      <Suspense fallback={null}>
        {isSettingsOpen && <SettingsModal />}
        {isTermsOpen && <TermsModal />}
        {isFAQOpen && <FAQModal />}
        {isFolderSelectOpen && <FolderSelectModal />}
        {isTemplateOpen && <TemplateSelectModal />}
        {isVoiceOpen && <VoiceUploadModal />}
        {isImageOCROpen && <ImageOCRModal />}
        {isCommandPaletteOpen && <CommandPalette />}
        {isShortcutsOpen && <KeyboardShortcutsModal />}
        {slideViewMemoId != null && <SlideView />}
      </Suspense>

      <UndoToast />
      <ToastContainer />
      <EdgeLighting />
      <LockScreen />
      <UpdateBanner />
      <Suspense fallback={null}>
        <IOSInstallBanner />
        <TimeCapsuleBanner />
      </Suspense>
      {suggestedMemo && !isFocusMode && !isMemoRoute && (
        <ContextSuggestionBanner memo={suggestedMemo} onDismiss={dismissContextSuggestion} />
      )}
      {!isMemoRoute && <Suspense fallback={null}><FloatingTimer /></Suspense>}
    </div>
  )
}
