import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { MemoList } from './MemoList'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'

export function MemosLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isDesktop = useUIStore((s) => s.isDesktop)

  const isOnMemoRoute = location.pathname.startsWith('/memo/')

  // Keyboard shortcut: Ctrl+[ / Ctrl+] to navigate prev/next memo on a wide screen
  useEffect(() => {
    const handleSplitKeyDown = (e: KeyboardEvent) => {
      if (!useUIStore.getState().isDesktop) return
      if (!(e.ctrlKey || e.metaKey)) return
      if (e.key !== '[' && e.key !== ']') return

      const path = window.location.pathname
      const match = path.match(/^\/memo\/(\d+)$/)
      if (!match) return

      e.preventDefault()
      const currentId = Number(match[1])
      const allMemos = useMemoStore.getState().memos.filter((m) => !m.deletedAt)
      const idx = allMemos.findIndex((m) => m.id === currentId)
      if (idx === -1) return

      const nextIdx = e.key === ']' ? idx + 1 : idx - 1
      if (nextIdx >= 0 && nextIdx < allMemos.length) {
        navigate(`/memo/${allMemos[nextIdx].id}`)
      }
    }

    window.addEventListener('keydown', handleSplitKeyDown)
    return () => window.removeEventListener('keydown', handleSplitKeyDown)
  }, [navigate])

  // 넓은 화면(901px부터)에서 메모를 열지 않았을 때: 목록이 내용 영역 전체를 써요.
  // 예전에는 1280px부터 늘 둘로 나눠서, 메모를 고르기 전에는 오른쪽 칸이 통째로 비어 있었어요.
  if (isDesktop && !isOnMemoRoute) {
    return (
      <div className="h-full overflow-y-auto overscroll-contain">
        <MemoList />
      </div>
    )
  }

  // 901px부터, 메모를 열었을 때: 편집기가 내용 영역 전체를 써요. 목록 옆에 칸을 따로 세우지 않아요(상세는 키트의 서랍이고, 편집기는 서랍에 담기엔 넓어요)
  if (isDesktop) {
    return (
      <div className="h-full flex flex-col">
        <Outlet />
      </div>
    )
  }

  // Mobile: Standard outlet-based navigation with slide transition
  return (
    <div className={isOnMemoRoute ? 'h-full flex flex-col animate-slide-in-right' : undefined}>
      <Outlet />
    </div>
  )
}
