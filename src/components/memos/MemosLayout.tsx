import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef } from 'react'
import { MemoList } from './MemoList'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { LIST_MAX_W, LIST_MIN_W, usePanelWidth } from './panelWidth'

function ResizeHandle({ onResize }: { onResize: (deltaX: number) => void }) {
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const pointerIdRef = useRef<number | null>(null)
  const handleRef = useRef<HTMLDivElement>(null)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    isDragging.current = true
    lastX.current = e.clientX
    pointerIdRef.current = e.pointerId
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current) return
    const delta = e.clientX - lastX.current
    lastX.current = e.clientX
    onResize(delta)
  }, [onResize])

  const handlePointerUp = useCallback(() => {
    isDragging.current = false
    if (pointerIdRef.current !== null && handleRef.current) {
      try { handleRef.current.releasePointerCapture(pointerIdRef.current) } catch { /* already released */ }
      pointerIdRef.current = null
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  return (
    <div
      ref={handleRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="group relative w-1 shrink-0 cursor-col-resize hover:w-1.5 transition-all select-none touch-none"
      aria-label="패널 크기 조절"
      role="separator"
      aria-orientation="vertical"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
      <div className="h-full w-full bg-zinc-200 dark:bg-zinc-700 group-hover:bg-primary-400 group-active:bg-primary-500 transition-colors" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex gap-px">
          <div className="w-0.5 h-6 rounded-full bg-primary-400" />
          <div className="w-0.5 h-6 rounded-full bg-primary-400" />
        </div>
      </div>
    </div>
  )
}

export function MemosLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const isDesktop = useUIStore((s) => s.isDesktop)
  const isWideDesktop = useUIStore((s) => s.isWideDesktop)

  const isOnMemoRoute = location.pathname.startsWith('/memo/')

  // Resizable panel width
  const [listWidth, setListWidth] = usePanelWidth()
  const listWidthRef = useRef(listWidth)
  listWidthRef.current = listWidth
  const handleResize = useCallback((delta: number) => {
    const next = Math.max(LIST_MIN_W, Math.min(LIST_MAX_W, listWidthRef.current + delta))
    setListWidth(next)
  }, [setListWidth])

  // Keyboard shortcut: Ctrl+[ / Ctrl+] to navigate prev/next memo in split view
  useEffect(() => {
    const handleSplitKeyDown = (e: KeyboardEvent) => {
      if (!useUIStore.getState().isWideDesktop) return
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

  // 1280px부터, 메모를 열었을 때: 왼쪽에 목록(너비를 끌어 바꿀 수 있어요), 오른쪽에 편집기
  if (isWideDesktop) {
    return (
      // 내용 영역(mw-app-content)의 높이를 모두 써요. 목록과 편집기가 저마다 스크롤해요.
      <div className="h-full flex flex-row">
        <div
          className="shrink-0 border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto overscroll-contain"
          style={{ width: listWidth }}
        >
          <MemoList pane />
        </div>

        <ResizeHandle onResize={handleResize} />

        {/* flex flex-col이어야 편집기 라우트 래퍼의 flex-1이 칸의 높이를 채워요 */}
        <div className="flex-1 min-w-0 flex flex-col overflow-y-auto overscroll-contain">
          <Outlet />
        </div>
      </div>
    )
  }

  // 901~1279px, 메모를 열었을 때: 편집기가 내용 영역 전체를 써요 (가림막 위의 창으로 띄우면 둘레가 비어요)
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
