import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { WifiOff } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { BottomNav } from './components/layout/BottomNav'
import { MobileNav } from './components/layout/MobileNav'
import { Footer } from './components/layout/Footer'
import { SettingsModal } from './components/layout/SettingsModal'
import { TermsModal } from './components/layout/TermsModal'
import { FAQModal } from './components/layout/FAQModal'
import { UndoToast } from './components/ui/UndoToast'
import { ToastContainer } from './components/ui/Toast'
import { UpdateBanner } from './components/ui/UpdateBanner'
import { AppLoadingScreen } from './components/ui/AppLoadingScreen'
import { CommandPalette } from './components/ui/CommandPalette'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal'
import { IOSInstallBanner } from './components/ui/IOSInstallBanner'
import { FolderSelectModal } from './components/folders/FolderSelectModal'
import { TemplateSelectModal } from './components/editor/TemplateSelectModal'
import { FAB } from './components/ui/FAB'
import { VoiceUploadModal } from './components/voice/VoiceUploadModal'
import { ImageOCRModal } from './components/ocr/ImageOCRModal'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { useAuthStore } from './stores/authStore'
import { useUndoStore } from './stores/undoStore'
import { registerRefreshCallbacks } from './services/firestoreSync'

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const isOnline = useOnlineStatus()
  const navigate = useNavigate()
  const initializeMemos = useMemoStore((state) => state.initialize)
  const initializeFolders = useFolderStore((state) => state.initialize)
  const initSettings = useSettingsStore((state) => state.initialize)
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen)
  const isFocusMode = useUIStore((state) => state.isFocusMode)

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
      } finally {
        setIsInitialized(true)
      }
    }

    initApp()
  }, [initializeMemos, initializeFolders, initSettings])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Z: Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useUndoStore.getState().undo()
      }
      // Ctrl+N: New memo
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        navigate('/memo/new')
      }
      // Ctrl+K: Command palette
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // F-09: Galaxy Fold narrow screen detection
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 400px) and (min-height: 600px)')
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const isFold = e.matches
      useUIStore.setState({ isNarrowFold: isFold })
      document.documentElement.toggleAttribute('data-narrow-fold', isFold)
    }
    handleChange(mql) // Initial check
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
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
          'flex-1 flex flex-col',
          !isFocusMode && (isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16')
        )}
      >
        {!isFocusMode && <Header />}
        <main
          id="main-content"
          aria-live="polite"
          className={clsx(
            'flex-1',
            isFocusMode ? '' : 'pb-20',
            !isFocusMode && (isMemoRoute ? 'lg:pb-0 lg:overflow-hidden' : 'lg:pb-6')
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

      {/* Global Modals */}
      <SettingsModal />
      <TermsModal />
      <FAQModal />
      <FolderSelectModal />
      <TemplateSelectModal />
      <VoiceUploadModal />
      <ImageOCRModal />
      <CommandPalette />
      <KeyboardShortcutsModal />

      <UndoToast />
      <ToastContainer />
      <UpdateBanner />
      <IOSInstallBanner />
    </div>
  )
}
