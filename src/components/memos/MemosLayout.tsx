import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Keyboard, StickyNote } from 'lucide-react'
import { MemoList } from './MemoList'
import { MemoEditorModal } from '../editor/MemoEditorModal'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { useMemoStore } from '@/stores/memoStore'
import { MEMO_PAGE_BG } from '@/utils/constants'

const LIST_MIN_W = 280
const LIST_MAX_W = 600
const LIST_DEFAULT_W = 360
const STORAGE_KEY = 'memo-split-width'

function usePanelWidth() {
  const [width, setWidth] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const n = Number(saved)
        if (n >= LIST_MIN_W && n <= LIST_MAX_W) return n
      }
    } catch { /* noop */ }
    return LIST_DEFAULT_W
  })

  const persist = useCallback((w: number) => {
    setWidth(w)
    try { localStorage.setItem(STORAGE_KEY, String(w)) } catch { /* noop */ }
  }, [])

  return [width, persist] as const
}

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
  const defaultColor = useSettingsStore((s) => s.settings.memoSettings.defaultColor)
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

  // Wide desktop (xl: 1280px+): Master-detail split view with resizable panels
  if (isWideDesktop) {
    return (
      <div className={clsx('h-[calc(100dvh-4rem)] flex flex-row transition-colors duration-300', MEMO_PAGE_BG[defaultColor])}>
        {/* Left: MemoList panel (resizable, independent scroll) */}
        <div
          className="shrink-0 border-r border-zinc-200 dark:border-zinc-700 overflow-y-auto overscroll-contain"
          style={{ width: listWidth }}
        >
          <MemoList />
        </div>

        {/* Resize handle */}
        <ResizeHandle onResize={handleResize} />

        {/* Right: Editor panel or empty state (independent scroll) */}
        <div className="flex-1 min-w-0 overflow-y-auto overscroll-contain">
          {isOnMemoRoute ? (
            <Outlet />
          ) : (
            <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
              <div className="text-center">
                <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">메모를 선택하세요</p>
                <p className="text-xs mt-1 text-zinc-300 dark:text-zinc-600">
                  또는 Alt+N으로 새 메모 작성
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-4 text-xs text-zinc-300 dark:text-zinc-600">
                  <Keyboard className="w-3.5 h-3.5" />
                  <span>Ctrl+[ / ] 으로 메모 탐색</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Standard desktop (lg: 1024-1279px): Modal overlay
  if (isDesktop) {
    return (
      <div className={clsx('h-full flex flex-col transition-colors duration-300', MEMO_PAGE_BG[defaultColor])}>
        <div className="flex-1 overflow-y-auto">
          <MemoList />
        </div>
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
