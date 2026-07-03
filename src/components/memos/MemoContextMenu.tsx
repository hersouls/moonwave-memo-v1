import { CheckCircle, LayoutGrid, LayoutList, ArrowUpDown } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useUIStore } from '@/stores/uiStore'
import type { SortBy } from '@/lib/types'

const SORT_LABELS: Record<SortBy, string> = {
  updatedAt: '수정 날짜순',
  createdAt: '생성 날짜순',
  title: '제목순',
}

const SORT_ORDER: SortBy[] = ['updatedAt', 'createdAt', 'title']

export function MemoContextMenu() {
  const isContextMenuOpen = useUIStore((s) => s.isContextMenuOpen)
  const closeContextMenu = useUIStore((s) => s.closeContextMenu)
  const toggleSelectionMode = useUIStore((s) => s.toggleSelectionMode)
  const viewMode = useUIStore((s) => s.viewMode)
  const setViewMode = useUIStore((s) => s.setViewMode)
  const sortBy = useUIStore((s) => s.sortBy)
  const setSortBy = useUIStore((s) => s.setSortBy)

  const handleSelectMode = () => {
    toggleSelectionMode()
    closeContextMenu()
  }

  const handleToggleView = () => {
    setViewMode(viewMode === 'list' ? 'grid' : 'list')
    closeContextMenu()
  }

  const handleCycleSort = () => {
    const currentIndex = SORT_ORDER.indexOf(sortBy)
    const nextIndex = (currentIndex + 1) % SORT_ORDER.length
    setSortBy(SORT_ORDER[nextIndex])
    closeContextMenu()
  }

  // UX-09: desktop uses dropdown popover, mobile uses BottomSheet
  const isDesktop = useUIStore((s) => s.isDesktop)

  const menuItems = (
    <>
      <button
        onClick={handleSelectMode}
        className="ctx-menu__item"
      >
        <CheckCircle className="ctx-menu__item-icon" />
        메모 선택
      </button>

      <button
        onClick={handleToggleView}
        className="ctx-menu__item"
      >
        {viewMode === 'list' ? (
          <LayoutGrid className="ctx-menu__item-icon" />
        ) : (
          <LayoutList className="ctx-menu__item-icon" />
        )}
        보기 방식
        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          {viewMode === 'list' ? '목록' : '그리드'}
        </span>
      </button>

      <button
        onClick={handleCycleSort}
        className="ctx-menu__item"
      >
        <ArrowUpDown className="ctx-menu__item-icon" />
        정렬 기준
        <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
          {SORT_LABELS[sortBy]}
        </span>
      </button>
    </>
  )

  // Desktop: dropdown popover — same enter motion as the card context menu
  if (isDesktop) {
    if (!isContextMenuOpen) return null
    return (
      <>
        <div className="fixed inset-0 z-20" onClick={closeContextMenu} />
        <div className="ctx-menu absolute right-2 top-12 z-30 min-w-[200px] origin-top-right animate-in fade-in zoom-in-95 duration-150">
          <div className="flex flex-col">{menuItems}</div>
        </div>
      </>
    )
  }

  // Mobile: BottomSheet
  return (
    <BottomSheet isOpen={isContextMenuOpen} onClose={closeContextMenu}>
      <div className="flex flex-col -mx-5 -my-4">{menuItems}</div>
    </BottomSheet>
  )
}
