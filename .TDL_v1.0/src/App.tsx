import { Outlet, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Footer } from './components/layout/Footer'
import { BottomNav } from './components/layout/BottomNav'
import { MobileNav } from './components/layout/MobileNav'
import { SettingsModal } from './components/layout/SettingsModal'
import { FAQModal } from './components/layout/FAQModal'
import { TermsModal } from './components/layout/TermsModal'
import { TaskCreateModal } from './components/tasks/TaskCreateModal'
import { WelcomeWizard } from './components/onboarding/WelcomeWizard'
import { UndoToast } from './components/ui/UndoToast'
import { UpdateBanner } from './components/ui/UpdateBanner'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { useSettingsStore } from './stores/settingsStore'
import { useUIStore } from './stores/uiStore'
import { useNotificationStore } from './stores/notificationStore'
import { useUndoStore } from './stores/undoStore'
import { useTemplateStore } from './stores/templateStore'
import { useAuthStore } from './stores/authStore'
import { useProfileStore } from './stores/profileStore'
import { useGroupStore } from './stores/groupStore'
import { registerRefreshCallbacks } from './services/firestoreSync'
import { AppLoadingScreen } from './components/ui/AppLoadingScreen'
import { FocusMode } from './components/focus/FocusMode'
import { ConflictResolverModal } from './components/ui/ConflictResolverModal'
import { useGoalConfetti } from './hooks/useConfetti'

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false)
  const initializeTasks = useTaskStore((state) => state.initialize)
  const initializeCategories = useCategoryStore((state) => state.initialize)
  const initSettings = useSettingsStore((state) => state.initialize)
  const initializeTemplates = useTemplateStore((state) => state.initialize)
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen)
  const isTaskCreateModalOpen = useUIStore((s) => s.isTaskCreateModalOpen)
  const closeTaskCreateModal = useUIStore((s) => s.closeTaskCreateModal)
  const editingTask = useUIStore((s) => s.editingTask)
  const lastBackupDate = useSettingsStore((state) => state.settings.lastBackupDate)

  // Fire confetti when daily goal is reached
  useGoalConfetti()

  useEffect(() => {
    const initApp = async () => {
      try {
        // Parallel initialization of independent stores
        await Promise.all([
          initializeTasks(),
          initializeCategories(),
          initializeTemplates(),
        ])
        initSettings()

        // Register sync refresh callbacks & initialize auth
        registerRefreshCallbacks(
          () => useTaskStore.getState().refreshFromDb(),
          () => useCategoryStore.getState().refreshFromDb(),
        )
        useAuthStore.getState().initialize()

        // Cleanup expired notifications and check backup reminder
        const notificationStore = useNotificationStore.getState()
        notificationStore.cleanupExpired()
        notificationStore.checkBackupReminder(lastBackupDate)

        // Check task due/overdue notifications
        notificationStore.checkTaskDueNotifications()
        notificationStore.checkOverdueNotifications()

        // Initialize profile (streak calculation)
        useProfileStore.getState().initialize()

        // Initialize groups
        useGroupStore.getState().initialize()
      } finally {
        setIsInitialized(true)
      }
    }

    initApp()

    // Periodic notification checks (every 30 minutes)
    const notifInterval = setInterval(() => {
      const ns = useNotificationStore.getState()
      ns.checkTaskDueNotifications()
      ns.checkOverdueNotifications()
    }, 30 * 60 * 1000)

    return () => clearInterval(notifInterval)
  }, [])

  // Ctrl+Z / Ctrl+Y keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useUndoStore.getState().undo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        useUndoStore.getState().redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Sync currentView with URL for BottomNav active state
  const location = useLocation()
  const setCurrentView = useUIStore((state) => state.setCurrentView)

  useEffect(() => {
    const pathname = location.pathname
    if (pathname === '/' || pathname === '/tasks' || pathname.startsWith('/task/')) {
      setCurrentView('tasks')
    } else if (pathname === '/calendar') {
      setCurrentView('calendar')
    } else if (pathname.startsWith('/groups')) {
      setCurrentView('groups')
    } else if (pathname === '/profile' || pathname === '/activity') {
      setCurrentView('profile')
    }
  }, [location.pathname, setCurrentView])

  if (!isInitialized) {
    return <AppLoadingScreen />
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarOpen ? 'lg:ml-64' : 'lg:ml-16'
          }`}
      >
        <Header />
        <main id="main-content" className="flex-1 pb-20 lg:pb-6">
          <Outlet />
        </main>
        <Footer />
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Mobile Drawer Navigation */}
      <MobileNav />

      {/* Global Modals */}
      <TaskCreateModal
        isOpen={isTaskCreateModalOpen}
        onClose={closeTaskCreateModal}
        editTask={editingTask}
      />
      <SettingsModal />
      <WelcomeWizard />
      <FAQModal />
      <TermsModal />
      <ConflictResolverModal />

      {/* Undo Toast */}
      <UndoToast />

      {/* PWA Update Banner */}
      <UpdateBanner />

      {/* Focus Mode Overlay */}
      <FocusMode />
    </div>
  )
}
