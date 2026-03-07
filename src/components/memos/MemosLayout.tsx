import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import clsx from 'clsx'
import { MemoList } from './MemoList'
import { MemoEditorModal } from '../editor/MemoEditorModal'
import { useSettingsStore } from '@/stores/settingsStore'
import { MEMO_PAGE_BG } from '@/utils/constants'

export function MemosLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const defaultColor = useSettingsStore((s) => s.settings.memoSettings.defaultColor)

  // JS-based desktop detection (not CSS) to ensure single Outlet instance
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches
  )

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const isOnMemoRoute = location.pathname.startsWith('/memo/')

  if (isDesktop) {
    return (
      <div className={clsx('h-full flex flex-col transition-colors duration-300', MEMO_PAGE_BG[defaultColor])}>
        {/* Desktop: Full-width MemoList (always visible) */}
        <div className="flex-1 overflow-y-auto">
          <MemoList />
        </div>

        {/* Desktop: Memo editor in modal overlay */}
        {isOnMemoRoute && (
          <MemoEditorModal onClose={() => navigate('/memos')}>
            <Outlet />
          </MemoEditorModal>
        )}
      </div>
    )
  }

  // Mobile: Standard outlet-based navigation with slide transition
  return (
    <div className={clsx('flex-1 transition-colors duration-300', MEMO_PAGE_BG[defaultColor])}>
      <div className={isOnMemoRoute ? 'animate-slide-in-right' : ''}>
        <Outlet />
      </div>
    </div>
  )
}
