import { Home, FileText, Settings } from 'lucide-react'
import clsx from 'clsx'
import { useUIStore, type CurrentView } from '@/stores/uiStore'

interface NavItem {
  view: CurrentView
  label: string
  icon: typeof Home
}

const navItems: NavItem[] = [
  { view: 'dashboard', label: '홈', icon: Home },
  { view: 'memos', label: '메모', icon: FileText },
  { view: 'settings', label: '설정', icon: Settings },
]

export function BottomNav() {
  const { currentView, setCurrentView } = useUIStore()

  return (
    <nav className="bottom-nav fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 pb-safe backdrop-blur-sm md:hidden dark:border-gray-800 dark:bg-gray-900/95">
      <div className="flex h-14 items-stretch">
        {navItems.map(({ view, label, icon: Icon }) => {
          const isActive = currentView === view
          return (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={clsx(
                'flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors',
                isActive
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-400 dark:text-gray-500'
              )}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={clsx('h-5 w-5', isActive && 'stroke-[2.5]')} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
