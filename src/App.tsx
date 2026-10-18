import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { AppNav } from './components/layout/AppNav'
import { AppTop } from './components/layout/AppTop'
import { AppTabbar } from './components/layout/AppTabbar'
import { PullRefresh } from './mw/PullRefresh'
import { FloatingActionButton } from './mw/FloatingActionButton'
import { IcLineWifi, IcLineWrite } from './mw/icons'
import { themeHint, useTheme } from './mw/theme'
import { UndoToast } from './components/ui/UndoToast'
import { ToastContainer } from './components/ui/Toast'
import { UpdateBanner } from './components/ui/UpdateBanner'
import { RouteLoading } from './components/layout/PageLoading'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
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
import { connectivity } from './services/connectivity'
import { getCachedPosition, requestAndCachePosition, getSolarMode } from './services/solarCalculator'
import './styles/shell.css'
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
  const isMobile = useUIStore((state) => state.isMobile)
  const isFocusMode = useUIStore((state) => state.isFocusMode)
  const isKeyboardOpen = useUIStore((state) => state.isKeyboardOpen)
  // 세로로 스크롤되는 유일한 곳(mw-app-content). 당겨서 새로 고침과 '탭을 다시 눌러 맨 위로'가 여기를 써요.
  const content = useRef<HTMLElement>(null)

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

    // Back online (browser 'online' event, or a reachability probe that proved a stuck
    // navigator.onLine wrong) → replay the offline queue. The replay holds a cross-tab
    // Web Lock, so the other open tabs receiving the same signal skip instead of racing.
    const replayQueue = () => {
      import('./services/offlineQueue').then(({ processPendingSyncs }) => processPendingSyncs()).catch(console.error)
    }
    const unsubConnectivity = connectivity.subscribe((online) => { if (online) replayQueue() })

    // SW background sync is broadcast to every tab → same lock-guarded replay
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SYNC_PENDING_MEMOS') replayQueue()
    }
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      unsubConnectivity()
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  // A11Y: Theme change sr-only announcement
  // 고른 값(자동 · 밝게 · 어둡게)이 바뀔 때만 알려요. 자동일 때 해가 져서 바뀌는 것은 알리지 않아요.
  const { mode: theme, dark: themeDark } = useTheme()
  const [themeAnnouncement, setThemeAnnouncement] = useState('')
  const prevTheme = useRef(theme)
  useEffect(() => {
    if (prevTheme.current !== theme) {
      setThemeAnnouncement(`테마를 바꿨어요. 지금은 ${themeHint(theme, themeDark)}`)
      prevTheme.current = theme
      const t = setTimeout(() => setThemeAnnouncement(''), 3000)
      return () => clearTimeout(t)
    }
  }, [theme, themeDark])

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

  // F-09: 좁은 폰 화면(380px 이하)
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

  // 좁은 화면(900px 이하: 하단 탭). 뼈대가 바뀌는 너비는 키트와 같은 900px 하나예요.
  useEffect(() => {
    const mql = window.matchMedia(MEDIA.mobile)
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      useUIStore.setState({ isMobile: e.matches })
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

  // 메모의 맥락 기록과 상단 바의 날씨에 쓰는 값(대략의 위치, 날씨, 낮과 밤)을 한 시간마다 받아 둬요.
  // 화면의 색과 테마는 바꾸지 않아요: 테마는 설정의 data-theme 하나예요.
  const contextSyncEnabled = useSettingsStore((s) => s.settings.livingWorkspace.environmentThemeEnabled)
  useEffect(() => {
    if (!contextSyncEnabled) {
      useThemeOrchestrator.getState().setEnvironment(null, null, null)
      return
    }

    const syncEnvironment = async () => {
      let pos = getCachedPosition()
      if (!pos) pos = await requestAndCachePosition()
      if (!pos) return

      const solarMode = getSolarMode(pos.latitude, pos.longitude)
      const weather = await fetchWeather()

      useThemeOrchestrator.getState().setEnvironment(
        weather?.condition ?? null,
        weather?.temperature ?? null,
        solarMode
      )
    }

    syncEnvironment()
    const interval = setInterval(syncEnvironment, 60 * 60 * 1000) // every hour
    return () => clearInterval(interval)
  }, [contextSyncEnabled])

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

  // 화면을 옮기면 내용을 맨 위로, 뒤로 돌아오면 있던 자리로 (스크롤이 창이 아니라 내용 영역에서 일어나요)
  const scrollMemory = useRef(new Map<string, number>())
  const lastPath = useRef(location.pathname)
  useEffect(() => {
    const node = content.current
    if (!node) return
    const remember = () => scrollMemory.current.set(lastPath.current, node.scrollTop)
    node.addEventListener('scroll', remember, { passive: true })
    return () => node.removeEventListener('scroll', remember)
  }, [isInitialized])
  useEffect(() => {
    const node = content.current
    lastPath.current = location.pathname
    if (!node) return
    node.scrollTo({ top: scrollMemory.current.get(location.pathname) ?? 0, behavior: 'instant' })
  }, [location.pathname])

  useEffect(() => {
    const names: Record<string, string> = { dashboard: '홈', memos: '메모', memo: '메모', calendar: '캘린더', canvas: '캔버스' }
    document.title = `${names[location.pathname.split('/')[1] || 'dashboard'] ?? 'Memo'} · Memo`
  }, [location.pathname])

  // 섹션 단위 페이지 키: /memo/1 → /memo/2 (분할 뷰 내부 이동)에서는 리마운트하지 않고,
  // dashboard ↔ memos ↔ calendar 섹션 전환에서만 페이지 전환이 일어난다.
  const section = location.pathname.split('/')[1] || 'dashboard'
  const pageKey = section === 'memo' ? 'memos' : section
  const isEditorRoute = location.pathname.startsWith('/memo/')
  const fillsContent = isEditorRoute || (isMemoRoute && !isMobile)
  const refresh = () => Promise.all([useMemoStore.getState().refreshFromDb(), useFolderStore.getState().refreshFromDb()])

  return (
    <>
      <a className="mw-skip" href="#main-content">본문으로 건너뛰기</a>
      <div className={isFocusMode ? 'mw-app memo-focus' : 'mw-app'}>
        <AppNav inert={isFocusMode} />

        <div className="mw-app-main">
          <AppTop narrow={isMobile} inert={isFocusMode} />

          {/* A11Y: sr-only theme change announcement */}
          {themeAnnouncement && (
            <div className="mw-sr-only" role="status" aria-live="polite">{themeAnnouncement}</div>
          )}

          {!isOnline && (
            <div role="alert" className="mw-notice mw-notice--warn memo-offline">
              <IcLineWifi size={20} />
              <span>오프라인이에요. 바꾼 내용은 다시 연결되면 동기화해요.</span>
            </div>
          )}

          {/* 손가락으로 쓰는 기기에서 내용을 당기면 기기와 클라우드의 메모를 다시 읽어요 */}
          {isInitialized && <PullRefresh scroller={content} onRefresh={refresh} />}
          <main ref={content} id="main-content" className="mw-app-content">
            {/* TECH-02: ErrorBoundary wraps route content */}
            <ErrorBoundary>
              {/* 편집기와 넓은 화면의 메모 목록은 내용 영역의 높이를 채우고 저마다 스크롤해요 */}
              <div key={pageKey} className={[fillsContent && 'memo-fill', !supportsViewTransitions && 'page-enter'].filter(Boolean).join(' ') || undefined}>
                {/* 기기의 메모를 읽는 동안에도 뼈대와 화면의 제목은 바로 그려요. 내용의 자리만 먼저 보여 줘요 */}
                {isInitialized ? <Outlet /> : <RouteLoading />}
              </div>
            </ErrorBoundary>
          </main>

          {/* 주 행동은 화면에 하나: 좁은 화면에서는 하단 탭 위의 FAB (넓은 화면에서는 페이지 머리의 버튼) */}
          {!isEditorRoute && !isKeyboardOpen && (
            <div className="mw-app-action">
              <FloatingActionButton aria-label="새 메모 쓰기" onClick={() => navigate('/memo/new')}>
                <IcLineWrite size={24} />
              </FloatingActionButton>
            </div>
          )}

          <AppTabbar scroller={content} inert={isFocusMode} />
        </div>
      </div>

      {/* 기기의 메모를 읽은 뒤에 그리는 것들 (읽기 전에는 뼈대와 화면의 제목 · 내용의 자리만 있어요) */}
      {isInitialized && (
        <>
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
        </>
      )}
    </>
  )
}
