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
import { FolderSelectModal } from './components/folders/FolderSelectModal'
import { VoiceUploadModal } from './components/voice/VoiceUploadModal'
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

  // Global keyboard shortcuts: Ctrl+Z (undo), Ctrl+N (new memo)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useUndoStore.getState().undo()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault()
        navigate('/memo/new')
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
      <Sidebar />

      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
        }`}
      >
        <Header />
        <main
          id="main-content"
          className={clsx(
            'flex-1 pb-20',
            isMemoRoute ? 'lg:pb-0 lg:overflow-hidden' : 'lg:pb-6'
          )}
        >
          <Outlet />
        </main>
        {!isMemoRoute && <Footer />}
      </div>

      <BottomNav />
      <MobileNav />

      {/* Global Modals */}
      <SettingsModal />
      <TermsModal />
      <FAQModal />
      <FolderSelectModal />
      <VoiceUploadModal />

      <UndoToast />
      <ToastContainer />
      <UpdateBanner />
    </div>
  )
}
