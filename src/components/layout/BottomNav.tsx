import { AlignJustify, Calendar, Home, StickyNote, Settings } from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore, type CurrentView } from '@/stores/uiStore'
import { useViewTransition } from '@/hooks/useViewTransition'

export function BottomNav() {
  const isKeyboardOpen = useUIStore((state) => state.isKeyboardOpen)
  const isFocusMode = useUIStore((state) => state.isFocusMode)
  const { navigateWithTransition } = useViewTransition()
  const currentView = useUIStore((state) => state.currentView)
  const setCurrentView = useUIStore((state) => state.setCurrentView)
  const toggleMobileMenu = useUIStore((state) => state.openMobileMenu)
  const openSettingsModal = useUIStore((state) => state.openSettingsModal)

  // Hide bottom nav when keyboard is open to prevent iOS fixed element issues
  if (isKeyboardOpen) return null

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
      inert={isFocusMode || undefined}
      className={clsx(
        'md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[color-mix(in_srgb,var(--color-bg-elevated)_85%,transparent)] backdrop-blur-sm will-change-transform border-t border-zinc-200 dark:border-zinc-800 pb-safe',
        // 포커스 모드: 언마운트 대신 아래로 밀려나며 사라진다
        'transition-transform duration-300 ease-spring',
        isFocusMode && 'translate-y-full pointer-events-none'
      )}
      aria-label="하단 메인 네비게이션"
    >
      <ul className="flex items-center justify-around h-16 fold:h-12">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.id !== 'menu' && item.id !== 'settings' && currentView === item.id

          return (
            <li key={item.id} className="flex-1">
              <button
                onClick={() => handleNavigate(item.id)}
                className={clsx(
                  'group relative w-full flex flex-col items-center justify-center gap-1 py-2 transition-colors min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',
                  isActive
                    ? 'text-primary-600 dark:text-primary-400'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-primary-400'
                )}
                aria-current={isActive ? 'page' : undefined}
              >
                {isActive && (
                  // View Transition 이름 부여 — 탭 전환 시 인디케이터가 이전 탭에서 새 탭으로 morph
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-primary-500 dark:bg-primary-400"
                    style={{ viewTransitionName: 'bottom-nav-indicator' }}
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className="w-5 h-5 fold:w-4 fold:h-4 transition-transform duration-150 group-active:scale-95"
                  aria-hidden="true"
                />
                <span className="text-[10px] fold:text-[9px] font-medium">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
