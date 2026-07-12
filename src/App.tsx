import { Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router-dom'
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

// View Transitions 지원 브라우저는 VT 크로스페이드가 페이지 전환을 소유하고,
// 미지원 브라우저만 .page-enter 폴백 애니메이션을 사용한다 (이중 애니메이션 방지).
const supportsViewTransitions = typeof document !== 'undefined' && 'startViewTransition' in document

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()
  const initializeMemos = useMemoStore((state) => state.initialize)
  const initializeFolders = useFolderStore((state) => state.initialize)
  const initSettings = useSettingsStore((state) => state.initialize)
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen)
  const isTablet = useUIStore((state) => state.isTablet)
  const isMobile = useUIStore((state) => state.isMobile)
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

        // Restore sync-folder handle + permission (device-local; no-op when disabled).
        // Dynamically imported so the feature stays out of the initial bundle.
        import('@/services/syncFolder').then(({ initSyncFolder }) => initSyncFolder()).catch(() => {})

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
      // Alt+N: New memo (Ctrl+N은 Chrome/Edge 예약 단축키라 가로챌 수 없음)
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyN') {
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

  // Global keyboard/viewport tracker — 앱 생애주기 단일 소스(리마운트 없음).
  // 키보드 감지: baseline(지금까지 본 최대 vv.height, = 키보드 없는 높이) 대비 축소량.
  // visual만 주는 기기와 layout까지 함께 주는 기기 모두에서 신뢰 가능한 유일 신호가 vv.height라
  // innerHeight는 쓰지 않는다(회전 시 stale 값으로 오탐 방지). 핀치/접근성 확대(scale>1)는 제외.
  // --vvh/--vv-top으로 실제 가시영역도 노출. (알려진 한계: 키보드가 열린 채 회전하면 기준선이
  // 축소 높이로 재설정돼 다음 키보드 토글 전까지 일시적으로 감지가 풀릴 수 있다.)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const root = document.documentElement
    let baseline = vv.height
    let lastWidth = vv.width
    let lastOpen = false
    let lastKb = 0
    const update = () => {
      const h = vv.height
      if (vv.width !== lastWidth) { lastWidth = vv.width; baseline = h } // 회전: 기준선 재설정
      if (h > baseline) baseline = h
      const kbH = vv.scale > 1.01 ? 0 : Math.max(0, Math.round(baseline - h))
      const isOpen = kbH > 120
      root.style.setProperty('--vvh', `${Math.round(h)}px`)
      root.style.setProperty('--vv-top', `${Math.round(vv.offsetTop)}px`)
      // 값이 실제로 바뀔 때만 store 갱신 — URL바/핀치 스크롤마다 persist(localStorage) 쓰기 방지
      if (isOpen !== lastOpen || kbH !== lastKb) {
        lastOpen = isOpen
        lastKb = kbH
        useUIStore.getState().setKeyboardState(isOpen, isOpen ? kbH : 0)
      }
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
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

  // 섹션 단위 페이지 키: /memo/1 → /memo/2 (분할 뷰 내부 이동)에서는 리마운트하지 않고,
  // dashboard ↔ memos ↔ calendar 섹션 전환에서만 페이지 전환이 일어난다.
  const section = location.pathname.split('/')[1] || 'dashboard'
  const pageKey = section === 'memo' ? 'memos' : section

  return (
    <div
      className="min-h-screen bg-[var(--color-bg-secondary)] flex flex-col"
      style={{
        // 오프라인 배너 높이 — Header가 배너 아래에 sticky로 붙도록 CSS 변수로 전달
        ...(!isOnline ? { '--offline-h': '36px' } : {}),
        // 콘텐츠 좌측 인셋(사이드바 폭) — 키보드 열림 시 fixed 에디터가 사이드바를 덮지 않도록.
        // 모바일(<md)·포커스 모드엔 사이드바가 없으므로 0.
        '--content-left': isFocusMode || isMobile ? '0px' : sidebarExpanded ? '16rem' : '4rem',
      } as React.CSSProperties}
    >
      <AmbientBackground />

      {/* A11Y: sr-only theme change announcement */}
      {themeAnnouncement && (
        <div className="sr-only" role="status" aria-live="polite">{themeAnnouncement}</div>
      )}

      {/* Offline banner — 다크온라이트 경고색(AA 대비) + 슬라이드 다운 등장 */}
      {!isOnline && (
        <div
          role="alert"
          className="sticky top-0 z-[var(--z-sticky)] flex items-center justify-center gap-2 px-4 py-2 bg-warning-100 text-warning-900 dark:bg-warning-950 dark:text-warning-300 text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300 ease-enter"
        >
          <WifiOff className="w-4 h-4 text-warning-600 dark:text-warning-400" />
          오프라인 상태입니다. 변경사항은 연결 복구 시 동기화됩니다.
        </div>
      )}

      {/* 포커스 모드에서도 마운트 유지 — 크롬이 사라지는 대신 트랜지션으로 밀려난다 */}
      <Sidebar />

      <div
        className={clsx(
          // Sidebar appears at md+ (tablet & desktop); mobile (<md) uses bottom nav, no margin.
          // 사이드바 rail과 같은 300ms/spring 커브로 마진이 함께 움직인다 (접기 desync 방지)
          'flex-1 flex flex-col transition-[margin-left] duration-300 ease-spring',
          !isFocusMode && (sidebarExpanded ? 'md:ml-64' : 'md:ml-16')
        )}
      >
        <Header />
        <main
          id="main-content"
          className={clsx(
            'flex-1',
            // 모바일 하단 내비(h-16 + safe-area)만큼 하단 여백 확보; md+에서는 사이드바가 대체
            isFocusMode ? '' : 'pb-[calc(5rem+env(safe-area-inset-bottom,0px))]',
            !isFocusMode && (isMemoRoute ? 'md:pb-0 lg:overflow-hidden' : 'md:pb-6')
          )}
        >
          {/* TECH-02: ErrorBoundary wraps route content */}
          <ErrorBoundary>
            <div key={pageKey} className={supportsViewTransitions ? undefined : 'page-enter'}>
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>
        {!isMemoRoute && !isFocusMode && <Footer />}
      </div>

      {/* 포커스 모드: FAB는 페이드로 사라진다 (즉시 언마운트 방지) */}
      <div
        className={clsx('transition-opacity duration-200', isFocusMode && 'opacity-0 pointer-events-none')}
        inert={isFocusMode || undefined}
      >
        <FAB />
      </div>
      <BottomNav />
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

      {/* 라우트별 스크롤 복원 — 뒤로가기 시 위치 복원, 새 이동 시 최상단 */}
      <ScrollRestoration getKey={(loc) => loc.pathname} />
    </div>
  )
}
