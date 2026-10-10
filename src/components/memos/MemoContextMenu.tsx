import { createPortal } from 'react-dom'
import { Sheet } from '@/mw/Sheet'
import { useUIStore } from '@/stores/uiStore'
import type { SortBy } from '@/lib/types'
import { IcMwCheckCircle, IcMwGrid, IcMwList, IcMwSort } from '@/mw/icons'

const SORT_LABELS: Record<SortBy, string> = {
  updatedAt: '수정 날짜순',
  createdAt: '생성 날짜순',
  title: '제목순',
}

const SORT_ORDER: SortBy[] = ['updatedAt', 'createdAt', 'title']

const MENU_LABEL = '메모 목록 메뉴'

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

  // UX-09: 넓은 화면은 버튼 아래에 뜨는 메뉴, 좁은 화면은 키트의 시트
  const isDesktop = useUIStore((s) => s.isDesktop)
  const ViewIcon = viewMode === 'list' ? IcMwGrid : IcMwList
  const viewLabel = viewMode === 'list' ? '목록' : '그리드'

  // Desktop: dropdown popover — same enter motion as the card context menu
  if (isDesktop) {
    if (!isContextMenuOpen) return null
    return (
      <>
        <div className="fixed inset-0 z-20" onClick={closeContextMenu} />
        <div className="ctx-menu absolute right-2 top-12 z-30 min-w-[200px] origin-top-right animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col" role="menu" aria-label={MENU_LABEL}>
            <button type="button" role="menuitem" onClick={handleSelectMode} className="ctx-menu__item">
              <IcMwCheckCircle className="ctx-menu__item-icon" />
              메모 선택
            </button>
            <button type="button" role="menuitem" onClick={handleToggleView} className="ctx-menu__item">
              <ViewIcon className="ctx-menu__item-icon" />
              보기 방식
              <span className="ctx-menu__item-value">{viewLabel}</span>
            </button>
            <button type="button" role="menuitem" onClick={handleCycleSort} className="ctx-menu__item">
              <IcMwSort className="ctx-menu__item-icon" />
              정렬 기준
              <span className="ctx-menu__item-value">{SORT_LABELS[sortBy]}</span>
            </button>
          </div>
        </div>
      </>
    )
  }

  // 좁은 화면: 키트의 Sheet(이름, 가림막, 손잡이, 아래로 끌기, Esc · 뒤로 가기로 닫기).
  // 목록 안이 아니라 body에 그려요: 시트는 화면에 고정하는 부품이라 스크롤 상자 안에 두지 않아요.
  return createPortal(
    <Sheet open={isContextMenuOpen} onClose={closeContextMenu} label={MENU_LABEL}>
      <div className="mw-sheet__body">
        <button type="button" className="mw-sheet__item" onClick={handleSelectMode}>
          <span className="mw-sheet__icon"><IcMwCheckCircle size={24} /></span><span><b>메모 선택</b></span>
        </button>
        <button type="button" className="mw-sheet__item" onClick={handleToggleView}>
          <span className="mw-sheet__icon"><ViewIcon size={24} /></span><span><b>보기 방식</b></span>
          <span className="memo-sheet__count">{viewLabel}</span>
        </button>
        <button type="button" className="mw-sheet__item" onClick={handleCycleSort}>
          <span className="mw-sheet__icon"><IcMwSort size={24} /></span><span><b>정렬 기준</b></span>
          <span className="memo-sheet__count">{SORT_LABELS[sortBy]}</span>
        </button>
      </div>
    </Sheet>,
    document.body,
  )
}
