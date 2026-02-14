import { useUIStore } from '@/stores/uiStore'
import { useFolderStore } from '@/stores/folderStore'
import { useMemoStore } from '@/stores/memoStore'
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { clsx } from 'clsx'
import {
  StickyNote,
  ChevronDown,
  FileText,
  Hash,
  HelpCircle,
  Palette,
  Plus,
  Settings,
  Star,
  Trash2,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function MobileNav() {
  const navigate = useNavigate()

  const isMobileMenuOpen = useUIStore((state) => state.isMobileMenuOpen)
  const closeMobileMenu = useUIStore((state) => state.closeMobileMenu)
  const openSettingsModal = useUIStore((state) => state.openSettingsModal)
  const openFAQModal = useUIStore((state) => state.openFAQModal)
  const openTermsModal = useUIStore((state) => state.openTermsModal)
  const setCurrentView = useUIStore((state) => state.setCurrentView)
  const setActiveFilter = useUIStore((state) => state.setActiveFilter)
  const setActiveFolderId = useUIStore((state) => state.setActiveFolderId)
  const setActiveTag = useUIStore((state) => state.setActiveTag)
  const activeFilter = useUIStore((state) => state.activeFilter)
  const activeFolderId = useUIStore((state) => state.activeFolderId)
  const activeTag = useUIStore((state) => state.activeTag)

  const { folders } = useFolderStore()
  const { memos } = useMemoStore()

  const [isFolderExpanded, setIsFolderExpanded] = useState(true)
  const [isTagExpanded, setIsTagExpanded] = useState(false)

  const userFolders = folders.filter((f) => !f.isSystem)
  const trashFolder = folders.find((f) => f.isSystem)

  const activeMemos = memos.filter((m) => !m.deletedAt)
  const trashedCount = memos.filter((m) => !!m.deletedAt).length

  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    activeMemos.forEach((m) => m.tags.forEach((t) => tagSet.add(t)))
    return Array.from(tagSet).sort()
  }, [activeMemos])

  const folderCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    activeMemos.forEach((m) => {
      if (m.folderId != null) {
        counts[m.folderId] = (counts[m.folderId] || 0) + 1
      }
    })
    return counts
  }, [activeMemos])

  const handleNav = (action: () => void) => {
    closeMobileMenu()
    action()
    setCurrentView('memos')
    navigate('/memos')
  }

  const handleOpenSettings = () => {
    closeMobileMenu()
    openSettingsModal()
  }

  const handleOpenFAQ = () => {
    closeMobileMenu()
    openFAQModal()
  }

  const handleOpenTerms = () => {
    closeMobileMenu()
    openTermsModal()
  }

  const handleAddMemo = () => {
    closeMobileMenu()
    navigate('/memo/new')
  }

  const handleStarredClick = () => {
    handleNav(() => setActiveFilter('starred'))
  }

  // Body scroll lock when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  return (
    <Transition show={isMobileMenuOpen} as={Fragment}>
      <Dialog onClose={closeMobileMenu} className="relative z-50 lg:hidden" id="mobile-nav">
        {/* Backdrop */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm" aria-hidden="true" />
        </TransitionChild>

        {/* Drawer */}
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="-translate-x-full"
          enterTo="translate-x-0"
          leave="ease-in duration-200"
          leaveFrom="translate-x-0"
          leaveTo="-translate-x-full"
        >
          <DialogPanel
            className="fixed inset-y-0 left-0 w-full max-w-xs bg-white dark:bg-zinc-950 shadow-xl dark:shadow-zinc-900/50 flex flex-col"
            aria-labelledby="mobile-nav-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <StickyNote className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <div className="flex flex-col">
                  <span
                    id="mobile-nav-title"
                    className="font-bold text-zinc-900 dark:text-zinc-100"
                  >
                    Memo
                  </span>
                </div>
              </div>
              <button
                onClick={closeMobileMenu}
                className="p-2 -mr-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="메뉴 닫기"
              >
                <X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto py-4">
              {/* Add Memo Button */}
              <div className="px-2 mb-4">
                <button
                  onClick={handleAddMemo}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                  aria-label="새 메모 추가"
                >
                  <Plus className="w-5 h-5" aria-hidden="true" />
                  <span className="font-medium">새 메모 추가</span>
                </button>
              </div>

              {/* Menu Items */}
              <nav className="px-2" aria-label="모바일 메인 메뉴">
                <ul className="space-y-1" role="menu">
                  {/* All Memos */}
                  <li role="none">
                    <button
                      onClick={() => handleNav(() => setActiveFilter('all'))}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]',
                        activeFilter === 'all' && !activeFolderId && !activeTag
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      )}
                      role="menuitem"
                    >
                      <StickyNote className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">모든 메모</span>
                      <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                        {activeMemos.length}
                      </span>
                    </button>
                  </li>

                  {/* Starred Memos */}
                  <li role="none">
                    <button
                      onClick={handleStarredClick}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]',
                        activeFilter === 'starred'
                          ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                      )}
                      role="menuitem"
                    >
                      <Star className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">중요 메모</span>
                      {activeMemos.filter((m) => m.isStarred).length > 0 && (
                        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                          {activeMemos.filter((m) => m.isStarred).length}
                        </span>
                      )}
                    </button>
                  </li>

                  {/* Folders - Expandable */}
                  <li role="none">
                    <button
                      onClick={() => setIsFolderExpanded(!isFolderExpanded)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                      aria-expanded={isFolderExpanded}
                    >
                      <StickyNote className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">폴더</span>
                      <ChevronDown
                        className={clsx(
                          'w-4 h-4 ml-auto transition-transform duration-200',
                          isFolderExpanded && 'rotate-180'
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {isFolderExpanded && userFolders.length > 0 && (
                      <ul className="mt-1 ml-6 space-y-0.5" role="menu">
                        {userFolders.map((folder) => (
                          <li key={folder.id} role="none">
                            <button
                              onClick={() => handleNav(() => setActiveFolderId(folder.id!))}
                              className={clsx(
                                'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px] text-left',
                                activeFolderId === folder.id
                                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                              )}
                              role="menuitem"
                            >
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: folder.color }}
                                aria-hidden="true"
                              />
                              <span className="text-sm truncate">{folder.name}</span>
                              <span className="ml-auto text-xs text-zinc-400">
                                {folderCounts[folder.id!] || 0}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>

                  {/* Trash */}
                  {trashFolder && (
                    <li role="none">
                      <button
                        onClick={() => handleNav(() => setActiveFolderId(trashFolder.id!))}
                        className={clsx(
                          'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]',
                          activeFolderId === trashFolder.id
                            ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200'
                            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                        )}
                        role="menuitem"
                      >
                        <Trash2 className="w-5 h-5" aria-hidden="true" />
                        <span className="font-medium">{trashFolder.name}</span>
                        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                          {trashedCount}
                        </span>
                      </button>
                    </li>
                  )}

                  {/* Tags - Expandable */}
                  {allTags.length > 0 && (
                    <li role="none">
                      <button
                        onClick={() => setIsTagExpanded(!isTagExpanded)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                        role="menuitem"
                        aria-expanded={isTagExpanded}
                      >
                        <Hash className="w-5 h-5" aria-hidden="true" />
                        <span className="font-medium">태그</span>
                        <ChevronDown
                          className={clsx(
                            'w-4 h-4 ml-auto transition-transform duration-200',
                            isTagExpanded && 'rotate-180'
                          )}
                          aria-hidden="true"
                        />
                      </button>
                      {isTagExpanded && (
                        <ul className="mt-1 ml-6 space-y-0.5" role="menu">
                          {allTags.map((tag) => (
                            <li key={tag} role="none">
                              <button
                                onClick={() => handleNav(() => setActiveTag(tag))}
                                className={clsx(
                                  'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px] text-left',
                                  activeTag === tag
                                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                                )}
                                role="menuitem"
                              >
                                <Hash className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                                <span className="text-sm truncate">{tag}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )}

                  {/* Divider */}
                  <li aria-hidden="true" className="py-2">
                    <div className="border-t border-zinc-200 dark:border-zinc-800" />
                  </li>

                  {/* Theme */}
                  <li role="none">
                    <button
                      onClick={handleOpenSettings}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                    >
                      <Palette className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">테마</span>
                    </button>
                  </li>

                  {/* Help */}
                  <li role="none">
                    <button
                      onClick={handleOpenFAQ}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                    >
                      <HelpCircle className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">도움말</span>
                    </button>
                  </li>

                  {/* Settings */}
                  <li role="none">
                    <button
                      onClick={handleOpenSettings}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                    >
                      <Settings className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">설정</span>
                    </button>
                  </li>

                  {/* Terms */}
                  <li role="none">
                    <button
                      onClick={handleOpenTerms}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                    >
                      <FileText className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">서비스 약관</span>
                    </button>
                  </li>
                </ul>
              </nav>

              {/* Empty State */}
              {memos.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    등록된 메모가 없습니다.
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    메모를 추가하여 시작하세요.
                  </p>
                </div>
              )}
            </div>
          </DialogPanel>
        </TransitionChild>
      </Dialog>
    </Transition>
  )
}
