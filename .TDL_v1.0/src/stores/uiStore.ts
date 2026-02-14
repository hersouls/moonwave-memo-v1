import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Task } from '@/lib/types'

export type CurrentView = 'tasks' | 'calendar' | 'groups' | 'profile' | 'settings' | 'faq'

interface UIState {
  isSidebarOpen: boolean
  isTaskCreateModalOpen: boolean
  editingTask: Task | null

  // Category tab
  activeCategoryTab: number | null

  // Calendar
  calendarSelectedDate: string

  // Mobile navigation states
  currentView: CurrentView
  isMobileMenuOpen: boolean

  // Modal states
  isSettingsModalOpen: boolean
  isFAQModalOpen: boolean
  isTermsModalOpen: boolean

  // Selection mode
  isSelectionMode: boolean
  selectedTaskIds: Set<number>

  // Actions
  toggleSelectionMode: () => void
  toggleTaskSelection: (id: number) => void
  selectAllTasks: (ids: number[]) => void
  clearSelection: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openTaskCreateModal: () => void
  openTaskEditModal: (task: Task) => void
  closeTaskCreateModal: () => void

  // Category tab actions
  setActiveCategoryTab: (id: number | null) => void

  // Calendar actions
  setCalendarSelectedDate: (date: string) => void

  // Mobile navigation actions
  setCurrentView: (view: CurrentView) => void
  openMobileMenu: () => void
  closeMobileMenu: () => void
  toggleMobileMenu: () => void

  // Modal actions
  openSettingsModal: () => void
  closeSettingsModal: () => void
  openFAQModal: () => void
  closeFAQModal: () => void
  openTermsModal: () => void
  closeTermsModal: () => void
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      isTaskCreateModalOpen: false,
      editingTask: null,

      // Category tab (null = '모두')
      activeCategoryTab: null,

      // Calendar
      calendarSelectedDate: getTodayDateString(),

      // Mobile navigation initial states
      currentView: 'tasks' as CurrentView,
      isMobileMenuOpen: false,

      // Modal initial states
      isSettingsModalOpen: false,
      isFAQModalOpen: false,
      isTermsModalOpen: false,

      // Selection mode
      isSelectionMode: false,
      selectedTaskIds: new Set<number>(),

      toggleSelectionMode: () => {
        set((state) => ({
          isSelectionMode: !state.isSelectionMode,
          selectedTaskIds: state.isSelectionMode ? new Set<number>() : state.selectedTaskIds,
        }))
      },

      toggleTaskSelection: (id) => {
        set((state) => {
          const next = new Set(state.selectedTaskIds)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return { selectedTaskIds: next }
        })
      },

      selectAllTasks: (ids) => {
        set({ selectedTaskIds: new Set(ids) })
      },

      clearSelection: () => {
        set({ selectedTaskIds: new Set<number>() })
      },

      toggleSidebar: () => {
        set((state) => ({ isSidebarOpen: !state.isSidebarOpen }))
      },

      setSidebarOpen: (open) => {
        set({ isSidebarOpen: open })
      },

      openTaskCreateModal: () => {
        set({ isTaskCreateModalOpen: true, editingTask: null })
      },

      openTaskEditModal: (task) => {
        set({ isTaskCreateModalOpen: true, editingTask: task })
      },

      closeTaskCreateModal: () => {
        set({ isTaskCreateModalOpen: false, editingTask: null })
      },

      // Category tab actions
      setActiveCategoryTab: (id) => {
        set({ activeCategoryTab: id })
      },

      // Calendar actions
      setCalendarSelectedDate: (date) => {
        set({ calendarSelectedDate: date })
      },

      // Mobile navigation actions
      setCurrentView: (view) => {
        set({ currentView: view })
      },

      openMobileMenu: () => {
        set({ isMobileMenuOpen: true })
      },

      closeMobileMenu: () => {
        set({ isMobileMenuOpen: false })
      },

      toggleMobileMenu: () => {
        set((state) => ({ isMobileMenuOpen: !state.isMobileMenuOpen }))
      },

      // Modal actions
      openSettingsModal: () => {
        set({ isSettingsModalOpen: true })
      },

      closeSettingsModal: () => {
        set({ isSettingsModalOpen: false })
      },

      openFAQModal: () => {
        set({ isFAQModalOpen: true })
      },

      closeFAQModal: () => {
        set({ isFAQModalOpen: false })
      },

      openTermsModal: () => {
        set({ isTermsModalOpen: true })
      },

      closeTermsModal: () => {
        set({ isTermsModalOpen: false })
      },
    }),
    {
      name: 'todo-ui',
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        activeCategoryTab: state.activeCategoryTab,
      }),
    }
  )
)
