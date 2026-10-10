/* 뼈대의 메뉴: 사이드바, 하단 탭, 더보기 시트가 같은 답을 써요.
   지금 있는 곳(aria-current="page")은 언제나 한 곳이에요 (https://ux.moonwave.kr/patterns/app-shell#sidebar). */
import { useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useUIStore } from '@/stores/uiStore'
import { useViewTransition } from '@/hooks/useViewTransition'

export type NavKey = 'home' | 'memos' | 'starred' | 'calendar' | 'find' | `folder:${number}` | `tag:${string}`

/** 찾기 탭은 메모 목록을 찾기 칸에 포커스를 둔 채로 여는 주소예요. */
export const FIND_PATH = '/memos?find=1'

export function useNavCurrent(): NavKey {
  const location = useLocation()
  const activeFolderId = useUIStore((s) => s.activeFolderId)
  const activeFilter = useUIStore((s) => s.activeFilter)
  const activeTag = useUIStore((s) => s.activeTag)
  const path = location.pathname
  if (path === '/calendar') return 'calendar'
  if (path === '/memos' || path.startsWith('/memo/')) {
    if (path === '/memos' && new URLSearchParams(location.search).has('find')) return 'find'
    if (activeFolderId != null) return `folder:${activeFolderId}`
    if (activeTag) return `tag:${activeTag}`
    if (activeFilter === 'starred') return 'starred'
    return 'memos'
  }
  return 'home'
}

/** 하단 탭에서 지금 있는 칸: 탭에 없는 곳(중요, 폴더, 태그)은 더보기예요. */
export function tabOf(key: NavKey): 'home' | 'memos' | 'calendar' | 'find' | 'more' {
  return key === 'home' || key === 'memos' || key === 'calendar' || key === 'find' ? key : 'more'
}

export function useNavActions() {
  const { navigateWithTransition } = useViewTransition()
  const go = useCallback((path: string, before?: () => void) => {
    before?.()
    navigateWithTransition(path)
  }, [navigateWithTransition])
  return {
    home: () => go('/', () => useUIStore.getState().setCurrentView('dashboard')),
    memos: () => go('/memos', () => { const ui = useUIStore.getState(); ui.setActiveFilter('all'); ui.setCurrentView('memos') }),
    starred: () => go('/memos', () => { const ui = useUIStore.getState(); ui.setActiveFilter('starred'); ui.setCurrentView('memos') }),
    calendar: () => go('/calendar', () => useUIStore.getState().setCurrentView('calendar')),
    find: () => go(FIND_PATH, () => { const ui = useUIStore.getState(); ui.setActiveFilter('all'); ui.setCurrentView('memos') }),
    folder: (id: number) => go('/memos', () => { const ui = useUIStore.getState(); ui.setActiveFolderId(id); ui.setCurrentView('memos') }),
    tag: (tag: string) => go('/memos', () => { const ui = useUIStore.getState(); ui.setActiveTag(tag); ui.setCurrentView('memos') }),
  }
}

/** 수정 키나 가운데 버튼으로 누른 링크는 브라우저에 맡겨요(새 탭). */
export function plainClick(e: React.MouseEvent): boolean {
  return !(e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
}
