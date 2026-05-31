import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, StickyNote, Settings, LogOut, Cloud } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { IconButton } from '@/components/ui/IconButton'
import { Tooltip } from '@/components/ui/Tooltip'
import { ConnectionStatus } from '@/components/ui/ConnectionStatus'
import { WeatherWidget } from '@/components/ui/WeatherWidget'

export function Header() {
  const location = useLocation()
  const openSettingsModal = useUIStore((state) => state.openSettingsModal)
  const openMobileMenu = useUIStore((state) => state.openMobileMenu)
  const user = useAuthStore((state) => state.user)
  const syncStatus = useAuthStore((state) => state.syncStatus)
  const logout = useAuthStore((state) => state.logout)
  const displayName = user?.displayName || useSettingsStore.getState().settings.userProfile.name
  const isNarrowFold = useUIStore((state) => state.isNarrowFold)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // F-01: Auto-hide header on scroll for fold
  const [headerHidden, setHeaderHidden] = useState(false)
  const lastScrollY = useRef(0)
  useEffect(() => {
    if (!isNarrowFold) {
      setHeaderHidden(false)
      return
    }
    const handleScroll = () => {
      const currentY = window.scrollY
      setHeaderHidden(currentY > lastScrollY.current && currentY > 60)
      lastScrollY.current = currentY
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isNarrowFold])

  // UX-08: hide header on desktop when viewing editor
  const isEditorRoute = /^\/memo\/\d+$/.test(location.pathname) || location.pathname === '/memo/new'

  const syncStatusLabel = syncStatus === 'syncing' ? '동기화 중...' : syncStatus === 'synced' ? '동기화 완료' : syncStatus === 'error' ? '동기화 오류' : '로컬 전용'

  // UX-08: hide on desktop when in editor
  return (
    <header className={`sticky top-0 z-30 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm will-change-transform border-b border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ${isEditorRoute ? 'md:hidden' : ''} ${headerHidden ? '-translate-y-full' : ''}`}>
      <nav className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left: Mobile menu + Logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={openMobileMenu}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="메뉴 열기"
          >
            <Menu className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </button>

          <Link to="/" className="md:hidden flex items-center gap-2 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <StickyNote className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-zinc-900 dark:text-zinc-100">Memo</span>
          </Link>
        </div>

        {/* Greeting */}
        {user && !isNarrowFold && (
          <p className="hidden sm:block text-sm text-zinc-600 dark:text-zinc-400 ml-4 truncate max-w-[200px]">
            안녕하세요, <span className="font-semibold text-zinc-900 dark:text-zinc-100">{displayName}</span>님!
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <WeatherWidget />
          <ConnectionStatus />

          {/* User avatar with dropdown */}
          {user && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="mr-1 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                aria-label="프로필 메뉴"
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-zinc-800 shadow-sm object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-700 dark:text-primary-300 text-sm font-bold ring-2 ring-white dark:ring-zinc-800 shadow-sm">
                    {user.displayName?.[0] || user.email?.[0] || '?'}
                  </div>
                )}
              </button>

              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-zinc-800 rounded-xl shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-50" role="menu">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-700">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{user.displayName || '사용자'}</p>
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{user.email}</p>
                    </div>
                    {/* Sync status */}
                    <div className="px-4 py-2.5 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                      <Cloud className="w-3.5 h-3.5" />
                      {syncStatusLabel}
                    </div>
                    {/* Settings */}
                    <button
                      onClick={() => { openSettingsModal(); setShowProfileMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                      role="menuitem"
                    >
                      <Settings className="w-4 h-4" />
                      설정
                    </button>
                    {/* Logout */}
                    <button
                      onClick={() => { logout(); setShowProfileMenu(false) }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-danger-500 hover:bg-danger-50 dark:hover:bg-zinc-700"
                      role="menuitem"
                    >
                      <LogOut className="w-4 h-4" />
                      로그아웃
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Settings button — only show when not logged in (logged-in users have it in profile menu) */}
          {!user && (
            <Tooltip content="설정" placement="bottom">
              <IconButton
                plain
                color="secondary"
                onClick={openSettingsModal}
                aria-label="설정 열기"
              >
                <Settings className="w-5 h-5" />
              </IconButton>
            </Tooltip>
          )}

        </div>
      </nav>
    </header>
  )
}
