import { useUIStore } from '@/stores/uiStore'
import { useTaskStore } from '@/stores/taskStore'
import { useCategoryStore } from '@/stores/categoryStore'
import { Dialog, DialogPanel, Transition, TransitionChild } from '@headlessui/react'
import { clsx } from 'clsx'
import {
  CheckSquare,
  ChevronDown,
  Grid2X2,
  HelpCircle,
  Palette,
  Plus,
  Settings,
  Star,
  X,
} from 'lucide-react'
import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function MobileNav() {
  const navigate = useNavigate()

  const isMobileMenuOpen = useUIStore((state) => state.isMobileMenuOpen)
  const closeMobileMenu = useUIStore((state) => state.closeMobileMenu)
  const openSettingsModal = useUIStore((state) => state.openSettingsModal)
  const openFAQModal = useUIStore((state) => state.openFAQModal)
  const openTaskCreateModal = useUIStore((state) => state.openTaskCreateModal)
  const setCurrentView = useUIStore((state) => state.setCurrentView)

  const tasks = useTaskStore((state) => state.tasks)
  const categories = useCategoryStore((state) => state.categories)

  const [isCategoryExpanded, setIsCategoryExpanded] = useState(false)

  const starredTasks = tasks.filter((t) => t.isStarred && t.status === 'pending')

  const handleOpenSettings = () => {
    closeMobileMenu()
    openSettingsModal()
  }

  const handleOpenFAQ = () => {
    closeMobileMenu()
    openFAQModal()
  }

  const handleAddTask = () => {
    closeMobileMenu()
    openTaskCreateModal()
  }

  const handleStarredClick = () => {
    closeMobileMenu()
    setCurrentView('tasks')
    navigate('/?starred=true')
  }

  const handleCategoryClick = (categoryId: number) => {
    closeMobileMenu()
    setCurrentView('tasks')
    navigate(`/?category=${categoryId}`)
  }

  const handleThemeClick = () => {
    closeMobileMenu()
    openSettingsModal()
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
                  <CheckSquare className="w-5 h-5 text-white" aria-hidden="true" />
                </div>
                <div className="flex flex-col">
                  <span
                    id="mobile-nav-title"
                    className="font-bold text-zinc-900 dark:text-zinc-100"
                  >
                    To-Do List
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
              {/* Add Task Button */}
              <div className="px-2 mb-4">
                <button
                  onClick={handleAddTask}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                  aria-label="새 작업 추가"
                >
                  <Plus className="w-5 h-5" aria-hidden="true" />
                  <span className="font-medium">새 작업 추가</span>
                </button>
              </div>

              {/* Menu Items */}
              <nav className="px-2" aria-label="모바일 메인 메뉴">
                <ul className="space-y-1" role="menu">
                  {/* Starred Tasks */}
                  <li role="none">
                    <button
                      onClick={handleStarredClick}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                    >
                      <Star className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">별표 작업</span>
                      {starredTasks.length > 0 && (
                        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                          {starredTasks.length}
                        </span>
                      )}
                    </button>
                  </li>

                  {/* Categories - Expandable */}
                  <li role="none">
                    <button
                      onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                      aria-expanded={isCategoryExpanded}
                    >
                      <Grid2X2 className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">카테고리</span>
                      <ChevronDown
                        className={clsx(
                          'w-4 h-4 ml-auto transition-transform duration-200',
                          isCategoryExpanded && 'rotate-180'
                        )}
                        aria-hidden="true"
                      />
                    </button>
                    {isCategoryExpanded && categories.length > 0 && (
                      <ul className="mt-1 ml-6 space-y-0.5" role="menu">
                        {categories.map((category) => (
                          <li key={category.id} role="none">
                            <button
                              onClick={() => handleCategoryClick(category.id!)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px] text-left"
                              role="menuitem"
                            >
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: category.color }}
                                aria-hidden="true"
                              />
                              <span className="text-sm truncate">{category.name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>

                  {/* Theme */}
                  <li role="none">
                    <button
                      onClick={handleThemeClick}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                    >
                      <Palette className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">테마</span>
                    </button>
                  </li>

                  {/* FAQ */}
                  <li role="none">
                    <button
                      onClick={handleOpenFAQ}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 min-h-[44px]"
                      role="menuitem"
                    >
                      <HelpCircle className="w-5 h-5" aria-hidden="true" />
                      <span className="font-medium">FAQ</span>
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
                </ul>
              </nav>

              {/* Empty State */}
              {tasks.length === 0 && (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    등록된 작업이 없습니다.
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    작업을 추가하여 시작하세요.
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
