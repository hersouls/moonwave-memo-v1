import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SortBy, ViewMode, SearchFilters } from '@/lib/types'

export type CurrentView = 'dashboard' | 'memos' | 'calendar' | 'settings'

interface UIState {
  isSidebarOpen: boolean
  currentView: CurrentView
  isMobileMenuOpen: boolean

  // Filter
  activeFolderId: number | null
  activeFilter: 'all' | 'starred'
  activeTag: string | null
  searchQuery: string
  sortBy: SortBy
  viewMode: ViewMode

  // Modals
  isSettingsModalOpen: boolean
  isTermsModalOpen: boolean
  isFAQModalOpen: boolean
  isFolderSelectOpen: boolean
  isFolderSelectMemoId: number | null
  isContextMenuOpen: boolean
  isVoiceModalOpen: boolean
  isImageOCRModalOpen: boolean
  isCommandPaletteOpen: boolean
  isKeyboardShortcutsOpen: boolean
  isTemplateModalOpen: boolean
  slideViewMemoId: number | null
  isFocusMode: boolean
  isNarrowFold: boolean
  isMobile: boolean
  isTablet: boolean
  // Tablet sidebar starts collapsed (rail); independent of the persisted desktop state.
  tabletSidebarOpen: boolean
  isDesktop: boolean
  isWideDesktop: boolean
  isKeyboardOpen: boolean
  keyboardHeight: number
  searchFilters: SearchFilters

  // Selection
  isSelectionMode: boolean
  selectedMemoIds: number[]

  // Actions
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleTabletSidebar: () => void
  setCurrentView: (view: CurrentView) => void
  openMobileMenu: () => void
  closeMobileMenu: () => void

  setActiveFolderId: (id: number | null) => void
  setActiveFilter: (filter: 'all' | 'starred') => void
  setActiveTag: (tag: string | null) => void
  setSearchQuery: (query: string) => void
  setSortBy: (sort: SortBy) => void
  setViewMode: (mode: ViewMode) => void

  openSettingsModal: () => void
  closeSettingsModal: () => void
  openTermsModal: () => void
  closeTermsModal: () => void
  openFAQModal: () => void
  closeFAQModal: () => void

  openFolderSelect: (memoId?: number | null) => void
  closeFolderSelect: () => void
  openContextMenu: () => void
  closeContextMenu: () => void
  openVoiceModal: () => void
  closeVoiceModal: () => void
  openImageOCRModal: () => void
  closeImageOCRModal: () => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openKeyboardShortcuts: () => void
  closeKeyboardShortcuts: () => void
  openTemplateModal: () => void
  closeTemplateModal: () => void
  openSlideView: (memoId: number) => void
  closeSlideView: () => void
  toggleFocusMode: () => void
  setSearchFilters: (filters: Partial<SearchFilters>) => void
  resetSearchFilters: () => void

  setKeyboardState: (isOpen: boolean, height: number) => void
  toggleSelectionMode: () => void
  enterSelectionMode: (memoId: number) => void
  toggleMemoSelection: (id: number) => void
  selectAllMemos: (ids: number[]) => void
  clearSelection: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isSidebarOpen: true,
      currentView: 'dashboard',
      isMobileMenuOpen: false,

      activeFolderId: null,
      activeFilter: 'all',
      activeTag: null,
      searchQuery: '',
      sortBy: 'updatedAt',
      viewMode: 'list',

      isSettingsModalOpen: false,
      isTermsModalOpen: false,
      isFAQModalOpen: false,
      isFolderSelectOpen: false,
      isFolderSelectMemoId: null,
      isContextMenuOpen: false,
      isVoiceModalOpen: false,
      isImageOCRModalOpen: false,
      isCommandPaletteOpen: false,
      isKeyboardShortcutsOpen: false,
      isTemplateModalOpen: false,
      slideViewMemoId: null,
      isFocusMode: false,
      isNarrowFold: false,
      isMobile: false,
      isTablet: false,
      tabletSidebarOpen: false,
      isDesktop: false,
      isWideDesktop: false,
      isKeyboardOpen: false,
      keyboardHeight: 0,
      searchFilters: { dateRange: 'all', starredOnly: false, colorFilter: null },

      isSelectionMode: false,
      selectedMemoIds: [],

      toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      toggleTabletSidebar: () => set((s) => ({ tabletSidebarOpen: !s.tabletSidebarOpen })),
      setCurrentView: (view) => set({ currentView: view, isSelectionMode: false, selectedMemoIds: [] }),
      openMobileMenu: () => set({ isMobileMenuOpen: true }),
      closeMobileMenu: () => set({ isMobileMenuOpen: false }),

      setActiveFolderId: (id) => set({ activeFolderId: id, activeFilter: 'all', activeTag: null, isSelectionMode: false, selectedMemoIds: [] }),
      setActiveFilter: (filter) => set({ activeFilter: filter, activeFolderId: null, activeTag: null, isSelectionMode: false, selectedMemoIds: [] }),
      setActiveTag: (tag) => set({ activeTag: tag, activeFolderId: null, activeFilter: 'all', isSelectionMode: false, selectedMemoIds: [] }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setSortBy: (sort) => set({ sortBy: sort }),
      setViewMode: (mode) => set({ viewMode: mode }),

      openSettingsModal: () => set({ isSettingsModalOpen: true }),
      closeSettingsModal: () => set({ isSettingsModalOpen: false }),
      openTermsModal: () => set({ isTermsModalOpen: true }),
      closeTermsModal: () => set({ isTermsModalOpen: false }),
      openFAQModal: () => set({ isFAQModalOpen: true }),
      closeFAQModal: () => set({ isFAQModalOpen: false }),

      openFolderSelect: (memoId) => set({ isFolderSelectOpen: true, isFolderSelectMemoId: memoId ?? null }),
      closeFolderSelect: () => set({ isFolderSelectOpen: false, isFolderSelectMemoId: null }),
      openContextMenu: () => set({ isContextMenuOpen: true }),
      closeContextMenu: () => set({ isContextMenuOpen: false }),
      openVoiceModal: () => set({ isVoiceModalOpen: true }),
      closeVoiceModal: () => set({ isVoiceModalOpen: false }),
      openImageOCRModal: () => set({ isImageOCRModalOpen: true }),
      closeImageOCRModal: () => set({ isImageOCRModalOpen: false }),
      openCommandPalette: () => set({ isCommandPaletteOpen: true }),
      closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
      openKeyboardShortcuts: () => set({ isKeyboardShortcutsOpen: true }),
      closeKeyboardShortcuts: () => set({ isKeyboardShortcutsOpen: false }),
      openTemplateModal: () => set({ isTemplateModalOpen: true }),
      closeTemplateModal: () => set({ isTemplateModalOpen: false }),
      openSlideView: (memoId) => set({ slideViewMemoId: memoId }),
      closeSlideView: () => set({ slideViewMemoId: null }),
      toggleFocusMode: () => set((s) => ({ isFocusMode: !s.isFocusMode })),
      setSearchFilters: (filters) => set((s) => ({ searchFilters: { ...s.searchFilters, ...filters } })),
      resetSearchFilters: () => set({ searchFilters: { dateRange: 'all', starredOnly: false, colorFilter: null } }),

      setKeyboardState: (isOpen, height) => set({ isKeyboardOpen: isOpen, keyboardHeight: height }),
      toggleSelectionMode: () =>
        set((s) => ({
          isSelectionMode: !s.isSelectionMode,
          selectedMemoIds: s.isSelectionMode ? [] : s.selectedMemoIds,
        })),
      enterSelectionMode: (memoId) =>
        set({ isSelectionMode: true, selectedMemoIds: [memoId] }),
      toggleMemoSelection: (id) =>
        set((s) => ({
          selectedMemoIds: s.selectedMemoIds.includes(id)
            ? s.selectedMemoIds.filter((i) => i !== id)
            : [...s.selectedMemoIds, id],
        })),
      selectAllMemos: (ids) => set({ selectedMemoIds: ids }),
      clearSelection: () => set({ selectedMemoIds: [], isSelectionMode: false }),
    }),
    {
      name: 'memo-ui',
      // UX-16: persist filter state across sessions
      partialize: (state) => ({
        isSidebarOpen: state.isSidebarOpen,
        viewMode: state.viewMode,
        sortBy: state.sortBy,
        activeFolderId: state.activeFolderId,
        activeFilter: state.activeFilter,
        activeTag: state.activeTag,
      }),
    }
  )
)
