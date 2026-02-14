import { Link, useLocation } from 'react-router-dom'
import {
  ClipboardList,
  Calendar,
  FolderKanban,
  BarChart3,
  HelpCircle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckSquare,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Tooltip } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { useTaskStore } from '@/stores/taskStore'

type NavItemType = 'link' | 'modal'

interface NavItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  type: NavItemType
  path?: string
}

const navItems: NavItem[] = [
  { id: 'tasks', label: '작업', icon: ClipboardList, type: 'link', path: '/' },
  { id: 'calendar', label: '캘린더', icon: Calendar, type: 'link', path: '/calendar' },
  { id: 'groups', label: '그룹', icon: FolderKanban, type: 'link', path: '/groups' },
  { id: 'profile', label: '분석', icon: BarChart3, type: 'link', path: '/profile' },
  { id: 'faq', label: 'FAQ', icon: HelpCircle, type: 'modal' },
  { id: 'settings', label: '설정', icon: Settings, type: 'modal' },
]

export function Sidebar() {
  const location = useLocation()
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen)
  const toggleSidebar = useUIStore((state) => state.toggleSidebar)
  const openFAQModal = useUIStore((state) => state.openFAQModal)
  const openSettingsModal = useUIStore((state) => state.openSettingsModal)
  const tasks = useTaskStore((state) => state.tasks)

  const starredTasks = tasks.filter((t) => t.isStarred && t.status === 'pending')

  const handleNavClick = (item: NavItem) => {
    if (item.type === 'modal') {
      switch (item.id) {
        case 'faq':
          openFAQModal()
          break
        case 'settings':
          openSettingsModal()
          break
      }
    }
  }

  const isActive = (item: NavItem) => {
    if (item.type === 'link' && item.path) {
      if (item.path === '/') {
        return location.pathname === '/' || location.pathname === '/tasks'
      }
      if (item.path === '/groups') {
        return location.pathname.startsWith('/groups')
      }
      return location.pathname === item.path
    }
    return false
  }

  return (
    <aside
      className={clsx(
        'hidden lg:flex flex-col fixed h-screen bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 z-40',
        isSidebarOpen ? 'w-64' : 'w-16'
      )}
      role="complementary"
      aria-label="사이드 네비게이션"
      aria-expanded={isSidebarOpen}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-zinc-200 dark:border-zinc-800">
        <Link
          to="/"
          className="flex items-center gap-3 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg"
          aria-label="작업 목록으로 이동"
        >
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <CheckSquare className="w-5 h-5 text-white" aria-hidden="true" />
          </div>
          {isSidebarOpen && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-zinc-900 dark:text-zinc-100 truncate">
                To-Do List
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4" aria-label="주 메뉴">
        <ul className="space-y-1 px-2" role="menubar">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item)

            const navButton = item.type === 'link' ? (
              <Link
                to={item.path!}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  active
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
                role="menuitem"
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {isSidebarOpen && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
              </Link>
            ) : (
              <button
                onClick={() => handleNavClick(item)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                  'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                )}
                role="menuitem"
              >
                <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                {isSidebarOpen && (
                  <span className="text-sm font-medium truncate">{item.label}</span>
                )}
              </button>
            )

            return (
              <li key={item.id} role="none">
                {!isSidebarOpen ? (
                  <Tooltip content={item.label} placement="right">
                    {navButton}
                  </Tooltip>
                ) : (
                  navButton
                )}
              </li>
            )
          })}
        </ul>

        {/* Starred Tasks Section */}
        {isSidebarOpen && starredTasks.length > 0 && (
          <section className="mt-6 px-2" aria-labelledby="starred-heading">
            <h2
              id="starred-heading"
              className="px-3 mb-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider"
            >
              별표 작업
            </h2>
            <ul className="space-y-0.5" role="menu">
              {starredTasks.slice(0, 5).map((task) => {
                const active = location.pathname === `/task/${task.id}`

                return (
                  <li key={task.id} role="none">
                    <Link
                      to={`/task/${task.id}`}
                      className={clsx(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
                        active
                          ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                      )}
                      role="menuitem"
                      aria-current={active ? 'page' : undefined}
                    >
                      <Star
                        className="w-3.5 h-3.5 flex-shrink-0 text-warning-500 fill-warning-500"
                        aria-hidden="true"
                      />
                      <span className="text-sm truncate">{task.title}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Collapsed starred indicator */}
        {!isSidebarOpen && starredTasks.length > 0 && (
          <div className="mt-6 px-2" aria-label={`별표 작업 ${starredTasks.length}개`}>
            <div className="flex justify-center">
              <Tooltip content={`별표 작업 ${starredTasks.length}개`} placement="right">
                <div className="w-8 h-8 rounded-lg bg-warning-100 dark:bg-warning-900/30 flex items-center justify-center cursor-default">
                  <Star
                    className="w-4 h-4 text-warning-500 fill-warning-500"
                    aria-hidden="true"
                  />
                </div>
              </Tooltip>
            </div>
          </div>
        )}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800">
        {!isSidebarOpen ? (
          <Tooltip content="사이드바 펼치기" placement="right">
            <button
              onClick={toggleSidebar}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              aria-label="사이드바 펼치기"
              aria-expanded={false}
            >
              <ChevronRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </Tooltip>
        ) : (
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="사이드바 접기"
            aria-expanded={true}
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            <span className="text-sm">접기</span>
          </button>
        )}
      </div>
    </aside>
  )
}
