import { AlignJustify, Calendar, Home, StickyNote, Settings } from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore, type CurrentView } from '@/stores/uiStore'
import { useRipple } from '@/hooks/useRipple'
import { useViewTransition } from '@/hooks/useViewTransition'

export function BottomNav() {
  const { navigateWithTransition } = useViewTransition()
  const currentView = useUIStore((state) => state.currentView)
  const setCurrentView = useUIStore((state) => state.setCurrentView)
  const toggleMobileMenu = useUIStore((state) => state.openMobileMenu)
  const openSettingsModal = useUIStore((state) => state.openSettingsModal)

  const { createRipple } = useRipple()

  const handleNavigate = (target: CurrentView | 'menu' | 'settings') => {
    if (target === 'menu') {
      toggleMobileMenu()
      return
    }
    if (target === 'settings') {
      openSettingsModal()
      return
    }
    if (target === 'dashboard') {
      setCurrentView('dashboard')
      navigateWithTransition('/')
      return
    }
    if (target === 'calendar') {
      setCurrentView('calendar')
      navigateWithTransition('/calendar')
      return
    }
    if (target === 'memos') {
      setCurrentView('memos')
      navigateWithTransition('/memos')
      return
    }
  }

  const navItems = [
    { id: 'menu' as const, label: '메뉴', icon: AlignJustify },
    { id: 'dashboard' as const, label: '대시보드', icon: Home },
    { id: 'calendar' as const, label: '캘린더', icon: Calendar },
    { id: 'memos' as const, label: '메모', icon: StickyNote },
    { id: 'settings' as const, label: '설정', icon: Settings },
  ]

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-t border-zinc-200 dark:border-zinc-800 pb-safe"
      aria-label="하단 메인 네비게이션"
    >
      <ul className="flex items-center justify-around h-16 fold:h-12" role="menubar">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.id !== 'menu' && item.id !== 'settings' && currentView === item.id

          return (
            <li key={item.id} className="flex-1" role="none">
              <button
                onClick={(e) => { createRipple(e); handleNavigate(item.id) }}
                className={clsx(
                  'relative w-full flex flex-col items-center justify-center gap-1 py-2 transition-all min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400'
                )}
                role="menuitem"
                aria-current={isActive ? 'page' : undefined}
                aria-label={`${item.label}${isActive ? ' (현재 페이지)' : ''}`}
              >
                {isActive && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary-500 dark:bg-primary-400"
                    style={{ animation: 'tabIndicatorSlide 200ms ease-out' }}
                  />
                )}
                <Icon className={clsx('w-5 h-5 fold:w-4 fold:h-4 transition-transform duration-200', isActive && 'scale-110')} aria-hidden="true" />
                <span className="text-[10px] fold:text-[9px] font-medium">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
