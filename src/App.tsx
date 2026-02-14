import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import clsx from 'clsx'
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
import { KeyboardShortcutsModal } from './components/ui/KeyboardShortcutsModal'
import { FolderSelectModal } from './components/folders/FolderSelectModal'
import { VoiceUploadModal } from './components/voice/VoiceUploadModal'
import { ImageOCRModal } from './components/ocr/ImageOCRModal'
import { useMemoStore } from '@/stores/memoStore'
import { useFolderStore } from '@/stores/folderStore'
import { useSettingsStore } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { useAuthStore } from './stores/authStore'
import { useUndoStore } from './stores/undoStore'
import { registerRefreshCallbacks } from './services/firestoreSync'

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const navigate = useNavigate()
  const initializeMemos = useMemoStore((state) => state.initialize)
  const initializeFolders = useFolderStore((state) => state.initialize)
  const initSettings = useSettingsStore((state) => state.initialize)
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen)
  const isFocusMode = useUIStore((state) => state.isFocusMode)

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
    }
  }, [location.pathname, setCurrentView])

  if (!isInitialized) {
    return <AppLoadingScreen />
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col">
      {!isFocusMode && <Sidebar />}

      <div
        className={clsx(
          'flex-1 flex flex-col transition-all duration-300',
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
          <Outlet />
        </main>
        {!isMemoRoute && !isFocusMode && <Footer />}
      </div>

      {!isFocusMode && <BottomNav />}
      {!isFocusMode && <MobileNav />}

      {/* Global Modals */}
      <SettingsModal />
      <TermsModal />
      <FAQModal />
      <FolderSelectModal />
      <VoiceUploadModal />
      <ImageOCRModal />
      <CommandPalette />
      <KeyboardShortcutsModal />

      <UndoToast />
      <ToastContainer />
      <UpdateBanner />
    </div>
  )
}
